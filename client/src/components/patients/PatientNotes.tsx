import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useSocket } from "@/hooks/useSocket";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { MessageSquare, Reply, Edit, Trash2, Send, X, Users, User, Trash, Clock, ChevronUp, ChevronDown, Plus, MoreHorizontal, Archive, Bell, BellOff, UserMinus, Info } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface PatientNote {
  _id: string;
  content: string;
  authorName: string;
  authorId: string;
  createdAt: string;
  updatedAt: string;
  isPrivate: boolean;
  directedTo?: string | null;
  directedToName?: string | null;
  parentNoteId?: string | null;
  isArchived?: boolean;
  archivedAt?: string;
  archivedBy?: string;
  archivedByName?: string;
}

interface Thread {
  threadId: string;
  directedTo?: string | null;
  directedToName?: string | null;
  isGeneral: boolean;
  isChat: boolean;
  chatWith: string;
  notes: PatientNote[];
}

interface StaffMember {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  email: string;
}

interface PatientNotesProps {
  patientId: string;
}

export default function PatientNotes({ patientId }: PatientNotesProps) {
  const { data: notes = [], refetch, isLoading } = useQuery({
    queryKey: ["patient-notes", patientId],
    queryFn: async () => {
      console.log("📥 Fetching notes for patient:", patientId);
      const response = await fetch(`/api/patients/${patientId}/notes`);
      const data = await response.json();
      console.log("📥 Notes fetched:", data);
      return data;
    },
  });

  const { data: staff = [], isLoading: staffLoading } = useQuery({
    queryKey: ["staff"],
    queryFn: () => fetch("/api/staff/list").then(res => res.json()),
  });

  // Debug staff data
  console.log("🔍 Available staff members:", staff);

  const { data: user } = useQuery({
    queryKey: ["auth-user"],
    queryFn: () => fetch("/api/auth/user").then(res => res.json()),
  });

  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  // State management
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyInput, setReplyInput] = useState("");
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [selectedStaffMember, setSelectedStaffMember] = useState<string>("");
  const [staffPopoverOpen, setStaffPopoverOpen] = useState(false);
  const messageInputRef = useRef<HTMLTextAreaElement>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [readMessages, setReadMessages] = useState<Set<string>>(new Set());
  const [newMessages, setNewMessages] = useState<Set<string>>(new Set());

  // Save read messages to localStorage whenever they change
  useEffect(() => {
    if (user?.id && patientId && readMessages.size > 0) {
      try {
        localStorage.setItem(`readMessages_${patientId}_${user.id}`, JSON.stringify(Array.from(readMessages)));
        console.log("💾 Saved read messages to localStorage:", {
          patientId,
          userId: user.id,
          readCount: readMessages.size,
          readMessages: Array.from(readMessages)
        });
      } catch (error) {
        console.error("❌ Error saving read messages to localStorage:", error);
      }
    }
  }, [readMessages, patientId, user?.id]);

  // WebSocket integration for real-time updates
  const { socket } = useSocket({
    onNoteCreated: (data) => {
      console.log('🔌 WebSocket note_created received:', data);
      console.log('🔌 Current patientId:', patientId);
      console.log('🔌 Event patientId:', data.patientId);
      console.log('🔌 User ID:', user?.id);
      console.log('🔌 Author ID:', data.authorId);
      
      if (data.patientId === patientId) {
        console.log('📝 Real-time note created:', data);
        queryClient.invalidateQueries({ queryKey: ['patient-notes', patientId] });
        
        // Mark as new message if from other user and not already read
        if (data.authorId !== user?.id && data.note?._id && !readMessages.has(data.note._id)) {
          console.log('📝 Marking as new message:', data.note._id);
          setNewMessages(prev => new Set(Array.from(prev).concat(data.note._id)));
          toast({
            title: "New message",
            description: `${data.authorName} sent a message`,
          });
        } else {
          console.log('📝 Not marking as new message (own message or already read)');
        }
      } else {
        console.log('❌ Note created for different patient:', data.patientId, 'vs', patientId);
      }
    },
    onNoteUpdated: (data) => {
      if (data.patientId === patientId) {
        console.log('📝 Real-time note updated:', data);
        queryClient.invalidateQueries({ queryKey: ['patient-notes', patientId] });
        
        // Show toast for note updates from other users
        if (data.authorId !== user?.id) {
          toast({
            title: "Message updated",
            description: `${data.authorName} updated a message`,
          });
        }
      }
    },
    onNoteDeleted: (data) => {
      if (data.patientId === patientId) {
        console.log('📝 Real-time note deleted:', data);
        queryClient.invalidateQueries({ queryKey: ['patient-notes', patientId] });
        
        // Show toast for note deletions from other users
        if (data.authorId !== user?.id) {
          toast({
            title: "Message deleted",
            description: `${data.authorName} deleted a message`,
          });
        }
      }
    },
  });

  // Join patient-specific room when component mounts
  useEffect(() => {
    if (socket && patientId) {
      console.log("🔌 Socket connected:", socket.connected);
      console.log("🔌 Joining patient room:", patientId);
      socket.emit('join_patient_room', { patientId });
      
      // Test WebSocket connection
      socket.emit('ping');
      socket.on('pong', () => {
        console.log("✅ WebSocket connection is working");
      });
      

      
      // Verify room joining
      setTimeout(() => {
        console.log("🔌 Socket connected after room join:", socket.connected);
      }, 1000);
      
      return () => {
        console.log("🔌 Leaving patient room:", patientId);
        socket.emit('leave_patient_room', { patientId });
      };
    } else {
      console.log("❌ Socket or patientId not available:", { socket: !!socket, patientId });
    }
  }, [socket, patientId]);

  // Load read messages from localStorage when user data becomes available
  useEffect(() => {
    if (user?.id && patientId) {
      const saved = localStorage.getItem(`readMessages_${patientId}_${user.id}`);
      if (saved) {
        try {
          const savedReadMessages = new Set(JSON.parse(saved) as string[]);
          setReadMessages(savedReadMessages);
          console.log("📖 Loaded read messages from localStorage:", {
            patientId,
            userId: user.id,
            readCount: savedReadMessages.size,
            readMessages: Array.from(savedReadMessages)
          });
        } catch (error) {
          console.error("❌ Error parsing read messages from localStorage:", error);
          // Clear invalid data
          localStorage.removeItem(`readMessages_${patientId}_${user.id}`);
        }
      } else {
        console.log("📖 No saved read messages found for:", {
          patientId,
          userId: user.id
        });
      }
    }
  }, [user?.id, patientId]);
  
  const handleTypingStart = () => {
    if (!isTyping && socket) {
      setIsTyping(true);
      socket.emit('typing_start', { patientId, userId: user?.id, userName: user?.firstName });
    }
  };

  const handleTypingStop = () => {
    if (isTyping && socket) {
      setIsTyping(false);
      socket.emit('typing_stop', { patientId, userId: user?.id });
    }
  };

  // Handle typing events from other users
  useEffect(() => {
    if (!socket) return;

    const handleUserTypingStart = (data: any) => {
      if (data.patientId === patientId && data.userId !== user?.id) {
        setTypingUsers(prev => new Set(Array.from(prev).concat(data.userName)));
      }
    };

    const handleUserTypingStop = (data: any) => {
      if (data.patientId === patientId && data.userId !== user?.id) {
        setTypingUsers(prev => {
          const newSet = new Set(Array.from(prev));
          newSet.delete(data.userName);
          return newSet;
        });
      }
    };

    socket.on('user_typing_start', handleUserTypingStart);
    socket.on('user_typing_stop', handleUserTypingStop);

    return () => {
      socket.off('user_typing_start', handleUserTypingStart);
      socket.off('user_typing_stop', handleUserTypingStop);
    };
  }, [socket, patientId, user?.id]);

  // Auto-stop typing after 3 seconds of inactivity
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (isTyping) {
      timeout = setTimeout(() => {
        handleTypingStop();
      }, 3000);
    }
    return () => clearTimeout(timeout);
  }, [isTyping]);

  // Save read messages to localStorage whenever they change
  useEffect(() => {
    if (user?.id) {
      localStorage.setItem(`readMessages_${patientId}_${user.id}`, JSON.stringify(Array.from(readMessages)));
    }
  }, [readMessages, patientId, user?.id]);

  // Clear new messages that are already in localStorage as read (on page refresh)
  useEffect(() => {
    if (notes.length > 0 && user?.id) {
      // Remove any messages from newMessages that are already marked as read
      setNewMessages(prev => {
        const updated = new Set<string>();
        Array.from(prev).forEach(messageId => {
          if (!readMessages.has(messageId)) {
            updated.add(messageId);
          }
        });
        return updated;
      });
    }
  }, [notes.length > 0, user?.id, readMessages]);

  // Mark messages as read when thread is selected
  useEffect(() => {
    if (selectedThread && notes.length > 0) {
      const thread = notes.find((t: Thread) => t.threadId === selectedThread);
      if (thread) {
        const unreadMessages = thread.notes.filter((note: PatientNote) => 
          note.authorId !== user?.id && !readMessages.has(note._id)
        );
        
        if (unreadMessages.length > 0) {
          const newReadMessages = new Set(readMessages);
          unreadMessages.forEach((note: PatientNote) => newReadMessages.add(note._id));
          setReadMessages(newReadMessages);
          
          // Remove from new messages after marking as read
          setNewMessages(prev => {
            const updated = new Set(Array.from(prev));
            unreadMessages.forEach((note: PatientNote) => updated.delete(note._id));
            return updated;
          });

          // Dispatch custom event to notify PatientDetail component
          window.dispatchEvent(new CustomEvent('notes-read'));
        }
      }
    }
  }, [selectedThread, notes, user?.id, readMessages]);

  // Mutations
  const createNoteMutation = useMutation({
    mutationFn: async ({ content, isPrivate, directedTo, directedToName, parentNoteId }: {
      content: string;
      isPrivate: boolean;
      directedTo: string | null;
      directedToName: string | null;
      parentNoteId?: string | null;
    }) => {
      console.log("📝 Attempting to send message:", {
        content: content.substring(0, 50) + "...",
        directedTo,
        directedToName,
        isPrivate,
        patientId,
        url: `/api/patients/${patientId}/notes`
      });
      
      try {
        console.log("🌐 Making API request to:", `/api/patients/${patientId}/notes`);
        console.log("🌐 Request payload:", {
          content: content.substring(0, 50) + "...",
          isPrivate,
          directedTo,
          directedToName,
          parentNoteId,
        });
        
        const response = await apiRequest("POST", `/api/patients/${patientId}/notes`, {
          content,
          isPrivate,
          directedTo,
          directedToName,
          parentNoteId,
        });
        
        console.log("✅ API request successful:", response);
        return response;
      } catch (error) {
        console.error("❌ API request failed:", error);
        console.error("❌ Error details:", {
          message: (error as any).message,
          status: (error as any).status,
          response: (error as any).response
        });
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patient-notes", patientId] });
      setMessageInput("");
      setReplyInput("");
      setReplyingTo(null);
      toast({
        title: "Message sent",
        description: "Your message has been sent successfully.",
      });
    },
    onError: (error: any) => {
      console.error("❌ Failed to send message:", error);
      
      let errorMessage = "Failed to send message. Please try again.";
      
      if (error.message?.includes("401")) {
        errorMessage = "You need to be logged in to send messages. Please log in and try again.";
      } else if (error.message?.includes("403")) {
        errorMessage = "You don't have permission to send messages. Please contact your administrator.";
      } else if (error.message?.includes("404")) {
        errorMessage = "Patient not found. Please refresh the page and try again.";
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const editNoteMutation = useMutation({
    mutationFn: async ({ noteId, content }: { noteId: string; content: string }) => {
      return await apiRequest("PUT", `/api/notes/${noteId}`, { content });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patient-notes", patientId] });
      setEditingNote(null);
      setEditContent("");
      toast({
        title: "Message updated",
        description: "Your message has been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update message. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteNoteMutation = useMutation({
    mutationFn: async (noteId: string) => {
      return await apiRequest("DELETE", `/api/notes/${noteId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patient-notes", patientId] });
      toast({
        title: "Message deleted",
        description: "Your message has been deleted successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete message. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Helper functions
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getLastMessage = (thread: Thread) => {
    if (thread.notes.length === 0) return null;
    return thread.notes[thread.notes.length - 1];
  };

  const getUnreadCount = (thread: Thread) => {
    const unreadNotes = thread.notes.filter((note: PatientNote) => 
      note.authorId !== user?.id && !readMessages.has(note._id)
    );
    
    console.log("🔍 Unread count debug for thread:", thread.threadId, {
      totalNotes: thread.notes.length,
      unreadCount: unreadNotes.length,
      readMessagesSize: readMessages.size,
      currentUserId: user?.id,
      unreadNotes: unreadNotes.map(note => ({
        id: note._id,
        authorId: note.authorId,
        content: note.content.substring(0, 30) + "...",
        isRead: readMessages.has(note._id)
      }))
    });
    
    return unreadNotes.length;
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("🔍 handleSendMessage called:", {
      messageInput: messageInput.substring(0, 30) + "...",
      selectedThread,
      user: user?.id,
      isPrivate
    });
    
    if (!messageInput.trim() || !selectedThread) {
      console.log("❌ Early return - no message or no thread selected");
      return;
    }

    // Check if user is authenticated
    if (!user) {
      console.log("❌ No user found");
      toast({
        title: "Authentication Required",
        description: "You need to be logged in to send messages. Please log in and try again.",
        variant: "destructive",
      });
      return;
    }

    console.log("🔍 Available threads:", notes.map((t: Thread) => ({ 
      threadId: t.threadId, 
      directedTo: t.directedTo, 
      directedToName: t.directedToName,
      isGeneral: t.isGeneral,
      isChat: t.isChat,
      chatWith: t.chatWith,
      noteCount: t.notes.length
    })));
    console.log("🔍 Selected thread ID:", selectedThread);
    console.log("🔍 Current user:", { id: user?.id, name: `${user?.firstName} ${user?.lastName}`, role: user?.role });
    
    const thread = notes.find((t: Thread) => t.threadId === selectedThread);
    if (!thread) {
      console.log("❌ Thread not found:", selectedThread);
      console.log("❌ Available thread IDs:", notes.map((t: Thread) => t.threadId));
      return;
    }
    
    console.log("✅ Found thread:", {
      threadId: thread.threadId,
      directedTo: thread.directedTo,
      directedToName: thread.directedToName,
      noteCount: thread.notes.length
    });

    // Determine the correct recipient for this message
    let directedTo = thread.directedTo;
    let directedToName = thread.directedToName;
    
    // If this is a directed conversation, the recipient should be the other person
    if (thread.directedTo && thread.directedTo !== user?.id) {
      // Current user is sending to the person specified in the thread
      directedTo = thread.directedTo;
      directedToName = thread.directedToName;
    } else if (thread.directedTo && thread.directedTo === user?.id) {
      // Current user is in a conversation directed to themselves, 
      // so they should send to the other person in the conversation
      // Find the other person from the thread notes
      const otherNote = thread.notes.find((note: PatientNote) => note.authorId !== user?.id);
      if (otherNote) {
        directedTo = otherNote.authorId;
        directedToName = otherNote.authorName;
      }
    }

    const noteData = {
      content: messageInput.trim(),
      isPrivate,
      directedTo,
      directedToName,
    };
    
    console.log("📤 Final note data being sent:", {
      content: messageInput.trim(),
      isPrivate,
      directedTo: thread.directedTo,
      directedToName: thread.directedToName,
      currentUserId: user?.id,
      currentUserName: `${user?.firstName} ${user?.lastName}`
    });

    console.log("📤 Sending note data:", noteData);
    console.log("📤 Mutation starting...");
    
    createNoteMutation.mutate(noteData, {
      onSuccess: (response) => {
        console.log("✅ Message sent successfully - Server response:", response);
        setMessageInput("");
        handleTypingStop(); // Stop typing indicator when message is sent
        
        // Force refresh the notes data
        setTimeout(() => {
          console.log("🔄 Refreshing notes data...");
          queryClient.invalidateQueries({ queryKey: ['patient-notes', patientId] });
        }, 500);
      },
      onError: (error) => {
        console.error("❌ Message send failed:", error);
        console.error("❌ Error details:", {
          message: error.message,
          status: error.status,
          response: error.response
        });
      }
    });
  };

  const handleReply = (e: React.FormEvent, parentNoteId: string) => {
    e.preventDefault();
    if (!replyInput.trim()) return;

    const noteData = {
      content: replyInput.trim(),
      isPrivate: false,
      directedTo: null,
      directedToName: null,
      parentNoteId,
    };

    createNoteMutation.mutate(noteData);
  };

  const handleStartNewConversation = () => {
    if (!selectedStaffMember) return;

    const staffMember = staff.find((s: StaffMember) => s.id === selectedStaffMember);
    if (!staffMember) return;

    console.log("🔍 Starting conversation debug:", {
      currentUserId: user?.id,
      selectedStaffMember,
      staffMemberId: staffMember.id,
      staffMemberName: `${staffMember.firstName} ${staffMember.lastName}`,
      isSelfChat: user?.id === selectedStaffMember
    });

    // Create a new thread by sending a message
    const noteData = {
      content: "Started conversation",
      isPrivate: false,
      directedTo: selectedStaffMember,
      directedToName: `${staffMember.firstName} ${staffMember.lastName}`,
    };

    createNoteMutation.mutate(noteData, {
      onSuccess: () => {
        setShowNewConversation(false);
        setSelectedStaffMember("");
        setStaffPopoverOpen(false);
        
        // Wait for the data to refresh, then select the new conversation
        setTimeout(() => {
          // Create consistent thread ID for the conversation between these two people
          const sortedIds = [user?.id, selectedStaffMember].sort();
          const newThreadId = `chat_${sortedIds[0]}_${sortedIds[1]}`;
          setSelectedThread(newThreadId);
          
          // Focus on the message input
          setTimeout(() => {
            if (messageInputRef.current) {
              messageInputRef.current.focus();
            }
          }, 200);
        }, 500);
        
        toast({
          title: "Conversation started",
          description: `You can now chat with ${staffMember.firstName} ${staffMember.lastName}`,
        });
      }
    });
  };

  const handleEdit = (noteId: string, currentContent: string) => {
    setEditingNote(noteId);
    setEditContent(currentContent);
  };

  const handleEditSubmit = (noteId: string) => {
    if (!editContent.trim()) return;
    editNoteMutation.mutate({ noteId, content: editContent.trim() });
  };

  const handleDelete = (noteId: string) => {
    if (confirm("Are you sure you want to delete this message?")) {
      deleteNoteMutation.mutate(noteId);
    }
  };

  const canEditNote = (note: PatientNote) => {
    return user?.id === note.authorId || user?.role === "admin";
  };

  const canDeleteNote = (note: PatientNote) => {
    return user?.id === note.authorId || user?.role === "admin";
  };

  // Chat action handlers
  const handleMarkAllRead = () => {
    if (selectedThread) {
      const thread = notes.find((t: Thread) => t.threadId === selectedThread);
      if (thread) {
        const newReadMessages = new Set(readMessages);
        thread.notes.forEach((note: PatientNote) => {
          if (note.authorId !== user?.id) {
            newReadMessages.add(note._id);
          }
        });
        setReadMessages(newReadMessages);
        setNewMessages(prev => {
          const updated = new Set(Array.from(prev));
          thread.notes.forEach((note: PatientNote) => updated.delete(note._id));
          return updated;
        });

        // Dispatch custom event to notify PatientDetail component
        window.dispatchEvent(new CustomEvent('notes-read'));

        toast({
          title: "All messages marked as read",
          description: "All messages in this conversation have been marked as read",
        });
      }
    }
  };

  const handleClearChat = () => {
    if (selectedThread && confirm("Are you sure you want to clear this conversation? This action cannot be undone.")) {
      const thread = notes.find((t: Thread) => t.threadId === selectedThread);
      if (thread) {
        // Delete all notes in this thread
        thread.notes.forEach((note: PatientNote) => {
          deleteNoteMutation.mutate(note._id);
        });
        toast({
          title: "Conversation cleared",
          description: "All messages in this conversation have been deleted",
        });
      }
    }
  };

  const handleViewChatInfo = () => {
    const thread = notes.find((t: Thread) => t.threadId === selectedThread);
    if (thread) {
      toast({
        title: "Chat Information",
        description: `Conversation with ${thread.chatWith}\nTotal messages: ${thread.notes.length}`,
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading conversations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[600px] bg-white rounded-lg border shadow-sm">
      {/* Left Sidebar - Conversation List */}
      <div className="w-80 border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Messages</h2>
              <Button
                size="sm"
              variant="outline"
              onClick={() => setShowNewConversation(true)}
              className="h-8 w-8 p-0"
            >
              <Plus className="h-4 w-4" />
              </Button>
          </div>
        </div>

        {/* New Conversation Modal */}
        {showNewConversation && (
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <div className="space-y-3">
              <Label className="text-sm font-medium">Start conversation with:</Label>
              <Popover open={staffPopoverOpen} onOpenChange={setStaffPopoverOpen}>
                <PopoverTrigger asChild>
              <Button
                variant="outline"
                    role="combobox"
                    aria-expanded={staffPopoverOpen}
                    className="w-full justify-between"
                  >
                    {selectedStaffMember
                      ? (() => {
                          const member = staff.find((s: StaffMember) => s.id === selectedStaffMember);
                          return member ? `${member.firstName} ${member.lastName} (${member.role})` : "Select staff member";
                        })()
                      : "Select staff member"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0">
                  <Command>
                    <CommandInput placeholder="Search staff members..." />
                    <CommandList>
                      <CommandEmpty>
                        {staffLoading ? "Loading staff members..." : "No staff member found."}
                      </CommandEmpty>
                      <CommandGroup>
                        {Array.isArray(staff) && staff.length > 0 ? (
                          staff.map((member: StaffMember) => (
                            <CommandItem
                              key={member.id}
                              value={`${member.firstName} ${member.lastName} ${member.role} ${member.email}`}
                              onSelect={() => {
                                setSelectedStaffMember(member.id);
                                setStaffPopoverOpen(false);
                              }}
                            >
                              <Check
                                className={`mr-2 h-4 w-4 ${
                                  selectedStaffMember === member.id ? "opacity-100" : "opacity-0"
                                }`}
                              />
                              <div className="flex flex-col">
                                <span className="font-medium">
                                  {member.firstName} {member.lastName}
                                </span>
                                <span className="text-xs text-gray-500">
                                  {member.role} • {member.email}
                                </span>
                              </div>
                            </CommandItem>
                          ))
                        ) : (
                          !staffLoading && (
                            <CommandItem disabled>
                              No staff members available
                            </CommandItem>
                          )
                        )}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <div className="flex gap-2">
              <Button
                size="sm"
                  onClick={handleStartNewConversation}
                  disabled={!selectedStaffMember}
              >
                  Start Chat
              </Button>
                  <Button
                    size="sm"
                  variant="outline"
                  onClick={() => {
                    setShowNewConversation(false);
                    setSelectedStaffMember("");
                    setStaffPopoverOpen(false);
                  }}
                >
                  Cancel
                  </Button>
                </div>
              </div>
          </div>
        )}

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto">
          {notes.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 text-gray-400" />
              <p className="text-sm">No conversations yet</p>
              <p className="text-xs">Start a conversation to begin messaging</p>
            </div>
          ) : (
            <div className="space-y-1">
              {notes.map((thread: Thread) => {
                const lastMessage = getLastMessage(thread);
                const unreadCount = getUnreadCount(thread);
                const isSelected = selectedThread === thread.threadId;

                return (
                  <div
                    key={thread.threadId}
                    className={`p-3 cursor-pointer hover:bg-gray-50 transition-colors ${
                      isSelected ? "bg-blue-50 border-r-2 border-blue-500" : ""
                    }`}
                    onClick={() => {
                      setSelectedThread(thread.threadId);
                      // Automatically mark messages as read when thread is selected
                      const newReadMessages = new Set(readMessages);
                      thread.notes.forEach((note: PatientNote) => {
                        if (note.authorId !== user?.id) {
                          newReadMessages.add(note._id);
                        }
                      });
                      setReadMessages(newReadMessages);
                      setNewMessages(prev => {
                        const updated = new Set(Array.from(prev));
                        thread.notes.forEach((note: PatientNote) => updated.delete(note._id));
                        return updated;
                      });

                      // Dispatch custom event to notify PatientDetail component
                      window.dispatchEvent(new CustomEvent('notes-read'));
                    }}
                  >
                    <div className="flex items-center space-x-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="text-sm">
                          {(() => {
                            // Find who the OTHER person in this conversation is
                            const otherPerson = thread.notes.find((note: any) => note.authorId !== user?.id);
                            if (otherPerson) {
                              return getInitials(otherPerson.authorName);
                            }
                            
                            // Fallback logic
                            if (thread.threadId.startsWith('chat_')) {
                              const staffId = thread.threadId.replace('chat_', '');
                              const staffMember = staff.find((s: any) => s.id === staffId);
                              return staffMember ? getInitials(`${staffMember.firstName} ${staffMember.lastName}`) : getInitials(thread.chatWith);
                            }
                            return getInitials(thread.chatWith);
                          })()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {(() => {
                              console.log('🔍 SIDEBAR DEBUG - Thread:', {
                                threadId: thread.threadId,
                                currentUserId: user?.id,
                                currentUserName: `${user?.firstName} ${user?.lastName}`,
                                allNotes: thread.notes.map(n => ({ authorId: n.authorId, authorName: n.authorName }))
                              });
                              
                              // Find who the OTHER person in this conversation is
                              // Look through all notes to find someone who is NOT the current user
                              const otherPerson = thread.notes.find((note: any) => note.authorId !== user?.id);
                              if (otherPerson) {
                                console.log('🎯 SIDEBAR OTHER PERSON FOUND:', otherPerson.authorName);
                                return otherPerson.authorName;
                              }
                              
                              // Fallback logic
                              if (thread.threadId.startsWith('chat_')) {
                                const staffId = thread.threadId.replace('chat_', '');
                                const staffMember = staff.find((s: any) => s.id === staffId);
                                return staffMember ? `${staffMember.firstName} ${staffMember.lastName}` : thread.chatWith;
                              }
                              
                              if (thread.directedTo) {
                                if (user?.id === thread.notes[0]?.authorId) {
                                  return thread.directedToName || "Unknown User";
                                } else {
                                  return thread.notes[0]?.authorName || "Unknown User";
                                }
                              }
                              
                              return thread.chatWith;
                            })()}
                          </p>
                          {lastMessage && (
                            <span className="text-xs text-gray-500">
                              {formatDistanceToNow(new Date(lastMessage.createdAt), { addSuffix: true })}
                            </span>
                          )}
                        </div>
                        {lastMessage && (
                          <p className="text-xs text-gray-600 truncate">
                            {lastMessage.content}
                          </p>
                        )}
                          </div>
                      {unreadCount > 0 && (
                        <Badge variant="destructive" className="h-5 w-5 rounded-full p-0 text-xs animate-pulse flex items-center justify-center min-w-[1.25rem]">
                          {unreadCount}
                        </Badge>
                      )}
              </div>
                  </div>
                );
                                  })}
                    
                    {/* Typing Indicator */}
                    {typingUsers.size > 0 && (
                      <div className="px-4 py-2">
                        <div className="flex items-center space-x-2 text-sm text-gray-500">
                          <div className="flex space-x-1">
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
            </div>
                          <span>{Array.from(typingUsers).join(', ')} is typing...</span>
                        </div>
                      </div>
                    )}
            </div>
          )}
        </div>
                  </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedThread ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-gray-200 bg-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                          <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-sm">
                      {(() => {
                        const thread = notes.find((t: Thread) => t.threadId === selectedThread);
                        if (!thread) return "";
                        
                        // Find who the OTHER person in this conversation is
                        const otherPerson = thread.notes.find((note: any) => note.authorId !== user?.id);
                        if (otherPerson) {
                          return getInitials(otherPerson.authorName);
                        }
                        
                        // Fallback logic
                        if (selectedThread?.startsWith('chat_')) {
                          const staffId = selectedThread.replace('chat_', '');
                          const staffMember = staff.find((s: any) => s.id === staffId);
                          return staffMember ? getInitials(`${staffMember.firstName} ${staffMember.lastName}`) : "";
                        }
                        
                        return getInitials(thread.chatWith);
                      })()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="text-sm font-medium text-gray-900">
                      {(() => {
                        const thread = notes.find((t: Thread) => t.threadId === selectedThread);
                        if (!thread) return "";
                        
                        console.log('🔍 DERRICK DEBUG - Full thread:', {
                          selectedThread,
                          threadId: thread.threadId,
                          currentUserId: user?.id,
                          currentUserName: `${user?.firstName} ${user?.lastName}`,
                          thread: thread,
                          firstNote: thread.notes[0],
                          allNotes: thread.notes.map((n: PatientNote) => ({ authorId: n.authorId, authorName: n.authorName, content: n.content }))
                        });
                        
                        // Find who the OTHER person in this conversation is
                        // Look through all notes to find someone who is NOT the current user
                        const otherPerson = thread.notes.find((note: any) => note.authorId !== user?.id);
                        if (otherPerson) {
                          console.log('🎯 OTHER PERSON FOUND:', otherPerson.authorName);
                          return otherPerson.authorName;
                        }
                        
                        // Fallback logic
                        if (selectedThread?.startsWith('chat_')) {
                          const staffId = selectedThread.replace('chat_', '');
                          const staffMember = staff.find((s: any) => s.id === staffId);
                          return staffMember ? `${staffMember.firstName} ${staffMember.lastName}` : "Unknown User";
                        }
                        
                        if (thread.directedTo) {
                          if (user?.id === thread.notes[0]?.authorId) {
                            return thread.directedToName || "Unknown User";
                          } else {
                            return thread.notes[0]?.authorName || "Unknown User";
                          }
                        }
                        
                        return thread.chatWith;
                      })()}
                    </h3>
                    <p className="text-xs text-gray-500">Active now</p>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="ghost">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={handleMarkAllRead}>
                      <Bell className="h-4 w-4 mr-2" />
                      Mark all as read
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleViewChatInfo}>
                      <Info className="h-4 w-4 mr-2" />
                      Chat info
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={handleClearChat}
                      className="text-red-600 focus:text-red-600"
                    >
                      <Trash className="h-4 w-4 mr-2" />
                      Clear conversation
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {(() => {
                const thread = notes.find((t: Thread) => t.threadId === selectedThread);
                if (!thread) return null;

                return thread.notes.map((note: PatientNote) => {
                  const isOwnMessage = note.authorId === user?.id;
                  const isNewMessage = newMessages.has(note._id);
                  const isUnreadMessage = !isOwnMessage && !readMessages.has(note._id);
                  
                  return (
                    <div 
                      key={note._id} 
                      className={`flex ${isOwnMessage ? "justify-end" : "justify-start"} ${
                        isNewMessage ? "animate-pulse" : ""
                      }`}
                    >
                      <div className={`max-w-xs lg:max-w-md ${isOwnMessage ? "order-2" : "order-1"}`}>
                        {!isOwnMessage && (
                          <div className="flex items-center space-x-2 mb-1">
                            <Avatar className="h-6 w-6">
                            <AvatarFallback className="text-xs">
                              {getInitials(note.authorName)}
                            </AvatarFallback>
                          </Avatar>
                            <span className="text-xs text-gray-500">{note.authorName}</span>
                            </div>
                        )}
                        <div
                          className={`rounded-lg px-3 py-2 relative ${
                            isOwnMessage
                              ? "bg-blue-500 text-white"
                              : isUnreadMessage
                              ? "bg-yellow-100 border-2 border-yellow-300 text-gray-900"
                              : "bg-gray-100 text-gray-900"
                          }`}
                        >
                          {isNewMessage && (
                            <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-ping"></div>
                          )}
                            {editingNote === note._id ? (
                              <div className="space-y-2">
                                <Textarea
                                  value={editContent}
                                  onChange={(e) => setEditContent(e.target.value)}
                                  className="min-h-[60px]"
                                />
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() => handleEditSubmit(note._id)}
                                    disabled={editNoteMutation.isPending}
                                  >
                                    Save
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setEditingNote(null);
                                      setEditContent("");
                                    }}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            ) : (
                            <div>
                              <p className="text-sm">{note.content}</p>
                              <div className="flex items-center justify-between mt-1">
                                <span className="text-xs opacity-70">
                                  {formatDistanceToNow(new Date(note.createdAt), { addSuffix: true })}
                                </span>
                                {isOwnMessage && (
                                  <div className="flex items-center space-x-1">
                              {user?.role !== "frontdesk" && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setReplyingTo(note._id)}
                                        className="h-6 w-6 p-0"
                                >
                                        <Reply className="h-3 w-3" />
                                </Button>
                              )}
                              {canEditNote(note) && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleEdit(note._id, note.content)}
                                        className="h-6 w-6 p-0"
                                >
                                        <Edit className="h-3 w-3" />
                                </Button>
                              )}
                              {canDeleteNote(note) && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDelete(note._id)}
                                        className="h-6 w-6 p-0"
                                >
                                        <Trash2 className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                                )}
                          </div>
                            </div>
                          )}
                        </div>

                        {/* Reply form */}
                        {replyingTo === note._id && (
                          <div className="mt-2 ml-4">
                            <form onSubmit={(e) => handleReply(e, note._id)} className="space-y-2">
                              <Textarea
                                value={replyInput}
                                onChange={(e) => setReplyInput(e.target.value)}
                                placeholder="Write your reply..."
                                className="min-h-[60px]"
                              />
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  type="submit"
                                  disabled={createNoteMutation.isPending || !replyInput.trim()}
                                >
                                  <Send className="h-3 w-3 mr-1" />
                                  Reply
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setReplyingTo(null);
                                    setReplyInput("");
                                  }}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </form>
                          </div>
                        )}
                  </div>
                </div>
              );
                });
              })()}
            </div>

            {/* Input Area */}
            <div className="p-4 border-t border-gray-200 bg-white">
              {!user ? (
                <div className="text-center py-4">
                  <div className="text-sm text-gray-500 mb-2">You need to be logged in to send messages</div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => window.location.href = "/login"}
                  >
                    Go to Login
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSendMessage} className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="private"
                        checked={isPrivate}
                        onCheckedChange={(checked) => setIsPrivate(checked as boolean)}
                      />
                      <Label htmlFor="private" className="text-xs">Private</Label>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <Textarea
                      ref={messageInputRef}
                      value={messageInput}
                      onChange={(e) => {
                        setMessageInput(e.target.value);
                        handleTypingStart();
                      }}
                      onKeyDown={handleTypingStart}
                      placeholder="Type a message..."
                      className="flex-1 resize-none"
                      rows={2}
                    />
                    <Button
                      type="submit"
                      disabled={createNoteMutation.isPending || !messageInput.trim()}
                      className="self-end"
                      onClick={() => console.log("🔍 Send button clicked - Debug:", {
                        isPending: createNoteMutation.isPending,
                        messageInput: messageInput.substring(0, 30) + "...",
                        hasMessage: !!messageInput.trim(),
                        selectedThread,
                        user: user?.id
                      })}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </form>
          )}
        </div>
          </>
        ) : (
          /* Empty State */
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Select a conversation</h3>
              <p className="text-gray-500">Choose a conversation from the sidebar to start messaging</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 