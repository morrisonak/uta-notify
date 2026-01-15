/**
 * Server functions index
 * Re-exports all server functions for convenient imports
 */

// Incident functions
export {
  getIncidents,
  getIncident,
  createIncident,
  updateIncident,
  deleteIncident,
  getActiveIncidents,
} from "./incidents";

// Message functions
export {
  getMessages,
  getMessage,
  createMessage,
  updateMessage,
  deleteMessage,
  getMessageDeliveries,
  getMessagesToday,
  getMessageStats,
} from "./messages";

// Subscriber functions
export {
  getSubscribers,
  getSubscriber,
  createSubscriber,
  updateSubscriber,
  deleteSubscriber,
  getSubscriberStats,
  unsubscribe,
} from "./subscribers";

// Dashboard functions
export {
  getDashboardStats,
  getRecentActivity,
  getActiveIncidentsSummary,
  getChannelHealth,
  getIncidentsBySeverity,
  getMessagesByChannel,
  getStorageUsage,
} from "./dashboard";

// Auth server functions
export { getSessionFn, signInFn, signOutFn } from "./auth";
