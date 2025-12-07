import React, { useState, useEffect } from 'react';
import { Event, EventCategory, User } from './types';
import { EventCard } from './components/EventCard';
import { Button } from './components/Button';
import { CreateEventModal } from './components/CreateEventModal';
import { EventAttendeesModal } from './components/EventAttendeesModal';
import { EventRegistrationModal } from './components/EventRegistrationModal';
import { Auth } from './components/Auth';
import { dataService } from './services/dataService';
import { Plus, Search, Calendar as CalendarIcon, Filter, GraduationCap, LogOut, Wifi, RefreshCw, LayoutDashboard, Ticket, Trash2 } from 'lucide-react';

// Helper to get relevant images based on category
const getCategoryImage = (category: EventCategory): string => {
  const images = {
    [EventCategory.ACADEMIC]: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&q=80&w=1000',
    [EventCategory.SOCIAL]: 'https://images.unsplash.com/photo-1523301386673-989097b4a149?auto=format&fit=crop&q=80&w=1000',
    [EventCategory.SPORTS]: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&q=80&w=1000',
    [EventCategory.CULTURAL]: 'https://images.unsplash.com/photo-1514525253440-b393452e8d03?auto=format&fit=crop&q=80&w=1000',
    [EventCategory.WORKSHOP]: 'https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&q=80&w=1000',
    [EventCategory.CAREER]: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&q=80&w=1000',
  };
  return images[category] || 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&q=80&w=1000';
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [registeredEventIds, setRegisteredEventIds] = useState<Set<string>>(new Set());
  const [view, setView] = useState<'dashboard' | 'my-events'>('dashboard');
  
  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | undefined>(undefined);
  const [selectedEventForAttendees, setSelectedEventForAttendees] = useState<Event | null>(null);
  const [selectedEventForRegistration, setSelectedEventForRegistration] = useState<Event | null>(null);
  const [registrationMode, setRegistrationMode] = useState<'form' | 'ticket'>('form');

  const [selectedCategory, setSelectedCategory] = useState<EventCategory | 'All'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [notification, setNotification] = useState<string | null>(null);
  const [loadingEvents, setLoadingEvents] = useState(false);

  // Load user from session if desired, but for now we start at login
  
  // Fetch events on load and when user logs in
  const fetchEvents = async () => {
      setLoadingEvents(true);
      try {
          const loadedEvents = await dataService.getEvents();
          setEvents(loadedEvents);
      } catch (err) {
          console.error(err);
          showNotification("Failed to load events from server");
      } finally {
          setLoadingEvents(false);
      }
  };

  const fetchRegistrations = async () => {
      if (!user) return;
      try {
          const ids = await dataService.getUserRegistrations(user.id);
          setRegisteredEventIds(new Set(ids));
      } catch (err) {
          console.error("Failed to load registrations", err);
      }
  };

  useEffect(() => {
      if (user) {
          fetchEvents();
          fetchRegistrations();
          if (user.role === 'admin') {
              setView('dashboard');
          }
      }
  }, [user]);

  // Filter Logic
  const filteredEvents = events.filter(event => {
    // 1. Filter by View (Dashboard vs My Events)
    if (view === 'my-events' && !registeredEventIds.has(event.id)) {
        return false;
    }

    // 2. Filter by Category
    const matchesCategory = selectedCategory === 'All' || event.category === selectedCategory;
    
    // 3. Filter by Search Query
    const matchesSearch = event.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          event.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesCategory && matchesSearch;
  });

  const handleSaveEvent = async (eventData: Omit<Event, 'id' | 'attendees'>) => {
    try {
        const finalImage = eventData.imageUrl.trim() || getCategoryImage(eventData.category);
        
        if (editingEvent) {
          // Update existing event
          await dataService.updateEvent({
            ...editingEvent,
            ...eventData,
            imageUrl: finalImage
          });
          showNotification(`Event "${eventData.title}" updated successfully!`);
        } else {
          // Create new event
          await dataService.createEvent({
              ...eventData,
              imageUrl: finalImage
          });
          showNotification(`Event "${eventData.title}" created successfully!`);
        }
        fetchEvents(); // Refresh list
    } catch (err) {
        showNotification(editingEvent ? "Failed to update event." : "Failed to create event.");
    } finally {
      setEditingEvent(undefined);
    }
  };

  const handleCreateClick = () => {
    setEditingEvent(undefined);
    setIsCreateModalOpen(true);
  };

  const handleEditClick = (event: Event) => {
    setEditingEvent(event);
    setIsCreateModalOpen(true);
  };

  const onRegisterClick = (eventId: string) => {
    const event = events.find(e => e.id === eventId);
    if (event) {
        setRegistrationMode('form');
        setSelectedEventForRegistration(event);
    }
  };

  const onDownloadTicketClick = (eventId: string) => {
    const event = events.find(e => e.id === eventId);
    if (event) {
        setRegistrationMode('ticket');
        setSelectedEventForRegistration(event);
    }
  };

  const handleRegistrationSuccess = () => {
    showNotification("Successfully registered!");
    fetchEvents(); // Refresh to show updated count
    fetchRegistrations(); // Refresh registrations to update UI
    if (view === 'my-events') {
        // Force re-render of my events list effectively
        fetchRegistrations(); 
    }
  };

  const handleDeleteEvent = async (id: string) => {
    if(!window.confirm("Are you sure you want to remove this event?")) return;
    
    // Optimistic UI Update: Remove from list immediately
    const previousEvents = [...events];
    setEvents(events.filter(e => e.id !== id));
    showNotification("Event deleted.");

    try {
      await dataService.deleteEvent(id);
      // Success, no need to do anything as UI is already updated
      // We can background refresh to be safe
      fetchEvents();
    } catch (err: any) {
      console.error(err);
      // Revert if failed
      setEvents(previousEvents);
      showNotification("Failed to delete event. Please try again.");
    }
  };

  const handleDeleteAllEvents = async () => {
    if (!window.confirm("WARNING: This will delete ALL events from the database. This cannot be undone. Are you sure?")) return;
    try {
      await dataService.deleteAllEvents();
      showNotification("All events have been deleted.");
      fetchEvents();
    } catch (err) {
      showNotification("Failed to delete all events.");
    }
  }

  const handleViewAttendees = (eventId: string) => {
    const event = events.find(e => e.id === eventId);
    if (event) {
        setSelectedEventForAttendees(event);
    }
  };

  const showNotification = (message: string) => {
    setNotification(message);
    setTimeout(() => setNotification(null), 3000);
  };

  const handleLogin = (loggedInUser: User) => {
    setUser(loggedInUser);
    showNotification(`Welcome back, ${loggedInUser.name}!`);
  };

  const handleLogout = () => {
    setUser(null);
    setEvents([]);
    setRegisteredEventIds(new Set());
    setNotification(null);
    setView('dashboard');
  };

  const getPageTitle = () => {
      if (view === 'my-events') return 'My Registrations';
      return user?.role === 'admin' ? 'Event Management Dashboard' : 'Upcoming Events';
  };

  const getPageDescription = () => {
      if (view === 'my-events') return 'Events you have signed up for.';
      return user?.role === 'admin' 
        ? 'Manage campus activities and oversee student engagement.' 
        : "Discover what's happening on campus this week.";
  };

  // Auth Screen
  if (!user) {
    return <Auth onLogin={handleLogin} />;
  }

  // Main App
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-gray-900">
      
      {/* Toast Notification */}
      {notification && (
          <div className="fixed top-20 right-5 z-50 bg-gray-900 text-white px-6 py-3 rounded-lg shadow-lg transform transition-all animate-fade-in-down flex items-center">
              <span className="mr-2">🎉</span> {notification}
          </div>
      )}

      {/* Navbar */}
      <nav className="bg-white shadow-sm sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center cursor-pointer" onClick={() => setView('dashboard')}>
              <GraduationCap className="h-8 w-8 text-brand-600" />
              <span className="ml-2 text-xl font-bold tracking-tight text-gray-900">Event<span className="text-brand-600">Hub</span></span>
              {user.role === 'admin' && (
                <span className="ml-3 px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-800 border border-red-200 uppercase tracking-wide">
                  Admin
                </span>
              )}
            </div>
            <div className="flex items-center space-x-4">
               <div className="hidden md:flex space-x-2 items-center">
                 <div className="flex items-center text-xs text-green-600 bg-green-50 px-2 py-1 rounded border border-green-200 mr-2" title="Connected to Firebase">
                      <Wifi className="w-3 h-3 mr-1" /> Firebase
                 </div>
                 <span className="text-sm text-gray-600 mr-2">Hello, {user.name}</span>
                 
                 <Button 
                    variant={view === 'dashboard' ? 'primary' : 'ghost'} 
                    size="sm" 
                    onClick={() => setView('dashboard')}
                    icon={<LayoutDashboard className="w-4 h-4" />}
                 >
                    Dashboard
                 </Button>
                 
                 {user.role === 'student' && (
                     <Button 
                        variant={view === 'my-events' ? 'primary' : 'ghost'} 
                        size="sm" 
                        onClick={() => setView('my-events')}
                        icon={<Ticket className="w-4 h-4" />}
                     >
                        My Events
                     </Button>
                 )}
               </div>
               
               <div className="h-8 w-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold border border-brand-200 cursor-default" title={user.name}>
                   {user.avatar}
               </div>

               <button 
                onClick={handleLogout}
                className="text-gray-400 hover:text-red-500 transition-colors p-2"
                title="Sign out"
               >
                 <LogOut className="w-5 h-5" />
               </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        
        {/* Header Section */}
        <div className="md:flex md:items-center md:justify-between mb-8">
          <div className="flex-1 min-w-0">
            <h2 className="text-3xl font-bold leading-7 text-gray-900 sm:text-4xl sm:truncate">
              {getPageTitle()}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {getPageDescription()}
            </p>
          </div>
          <div className="mt-4 flex md:mt-0 md:ml-4 space-x-3">
            {user.role === 'admin' && view === 'dashboard' && (
              <>
                <Button 
                  onClick={handleDeleteAllEvents} 
                  variant="outline"
                  className="border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400"
                  icon={<Trash2 className="w-4 h-4"/>}
                >
                  Clear All Events
                </Button>
                <Button onClick={handleCreateClick} icon={<Plus className="w-5 h-5"/>}>
                  Create Official Event
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Filters and Search */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-8 flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:w-96">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                    type="text"
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-gray-50 focus:bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-brand-500 focus:border-brand-500 sm:text-sm transition duration-150 ease-in-out text-gray-900"
                    placeholder="Search events..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>
            
            <div className="flex items-center space-x-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
                <button
                    onClick={() => { fetchEvents(); fetchRegistrations(); }}
                    className="p-2 text-gray-500 hover:text-brand-600 hover:bg-brand-50 rounded-full transition-colors mr-2 border border-transparent hover:border-brand-100"
                    title="Refresh Events"
                >
                    <RefreshCw className={`w-5 h-5 ${loadingEvents ? 'animate-spin text-brand-600' : ''}`} />
                </button>
                <Filter className="w-5 h-5 text-gray-400 mr-2 flex-shrink-0" />
                <button 
                    onClick={() => setSelectedCategory('All')}
                    className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${selectedCategory === 'All' ? 'bg-brand-600 text-white shadow-sm' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                >
                    All
                </button>
                {Object.values(EventCategory).map(cat => (
                    <button 
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${selectedCategory === cat ? 'bg-brand-600 text-white shadow-sm' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                    >
                        {cat}
                    </button>
                ))}
            </div>
        </div>

        {/* Admin Stats Banner (Only visible to admin on dashboard) */}
        {user.role === 'admin' && view === 'dashboard' && (
           <div className="mb-8 grid grid-cols-1 gap-5 sm:grid-cols-3">
             <div className="bg-white overflow-hidden shadow rounded-lg border border-gray-100">
               <div className="px-4 py-5 sm:p-6">
                 <dt className="text-sm font-medium text-gray-500 truncate">Total Events</dt>
                 <dd className="mt-1 text-3xl font-semibold text-gray-900">{events.length}</dd>
               </div>
             </div>
             <div className="bg-white overflow-hidden shadow rounded-lg border border-gray-100">
               <div className="px-4 py-5 sm:p-6">
                 <dt className="text-sm font-medium text-gray-500 truncate">Total Attendees</dt>
                 <dd className="mt-1 text-3xl font-semibold text-gray-900">{events.reduce((acc, curr) => acc + curr.attendees, 0)}</dd>
               </div>
             </div>
             <div className="bg-white overflow-hidden shadow rounded-lg border border-gray-100">
               <div className="px-4 py-5 sm:p-6">
                 <dt className="text-sm font-medium text-gray-500 truncate">Avg. Attendance</dt>
                 <dd className="mt-1 text-3xl font-semibold text-gray-900">
                    {events.length > 0 ? Math.round(events.reduce((acc, curr) => acc + curr.attendees, 0) / events.length) : 0}
                 </dd>
               </div>
             </div>
           </div>
        )}

        {/* Event Grid */}
        {loadingEvents ? (
            <div className="flex justify-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
            </div>
        ) : filteredEvents.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredEvents.map(event => (
                <EventCard 
                  key={event.id} 
                  event={event} 
                  onRegister={onRegisterClick}
                  isAdmin={user.role === 'admin'}
                  isRegistered={registeredEventIds.has(event.id)}
                  onDelete={handleDeleteEvent}
                  onEdit={handleEditClick}
                  onViewAttendees={handleViewAttendees}
                  onDownloadTicket={onDownloadTicketClick}
                />
            ))}
            </div>
        ) : (
            <div className="text-center py-20 bg-white rounded-xl border border-gray-200 border-dashed">
                <CalendarIcon className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No events found</h3>
                <p className="mt-1 text-sm text-gray-500">
                    {view === 'my-events' 
                        ? "You haven't registered for any events yet." 
                        : (user.role === 'admin' ? "Get started by creating a new event." : "Check back later for new events.")}
                </p>
                {view === 'my-events' && (
                    <div className="mt-6">
                        <Button onClick={() => setView('dashboard')}>
                            Browse Events
                        </Button>
                    </div>
                )}
                {user.role === 'admin' && view === 'dashboard' && (
                    <div className="mt-6">
                        <Button onClick={handleCreateClick} icon={<Plus className="w-4 h-4"/>}>
                            Create Event
                        </Button>
                    </div>
                )}
            </div>
        )}
      </main>

      <CreateEventModal 
        isOpen={isCreateModalOpen} 
        onClose={() => setIsCreateModalOpen(false)} 
        onSave={handleSaveEvent} 
        initialData={editingEvent}
      />

      {selectedEventForAttendees && (
        <EventAttendeesModal
            isOpen={!!selectedEventForAttendees}
            onClose={() => setSelectedEventForAttendees(null)}
            eventId={selectedEventForAttendees.id}
            eventTitle={selectedEventForAttendees.title}
        />
      )}

      {selectedEventForRegistration && (
          <EventRegistrationModal
             isOpen={!!selectedEventForRegistration}
             onClose={() => setSelectedEventForRegistration(null)}
             event={selectedEventForRegistration}
             user={user}
             onRegistrationSuccess={handleRegistrationSuccess}
             initialStep={registrationMode}
          />
      )}
    </div>
  );
};

export default App;