export interface Channel {
  id: string;
  enabled: boolean;
  connected: boolean;
  handle: string;
  followers: number;
  posts: number;
}

export interface Avatar {
  style: 'gradient' | 'emoji' | 'initials';
  from: string;
  to: string;
  emoji: string;
  label: string;
}

export interface Profile {
  name: string;
  headline: string;
  about: string;
  location: string;
  email: string;
  phone: string;
  website: string;
  avatar: Avatar;
  skills: string[];
  experience: { id: string; role: string; company: string; period: string; points: string[] }[];
  education: { id: string; school: string; degree: string; period: string }[];
  services: { id: string; name: string; desc: string; price: string }[];
}

export interface Campaign {
  id: string;
  name: string;
  goal: 'promote' | 'sell' | 'launch' | 'awareness' | 'grow';
  topic: string;
  product: string;
  audience: string;
  channels: string[];
  schedule: { mode: 'once' | 'recurring'; frequency: string; time: string; days: number[]; intervalDays: number; at: number | null };
  ai: { enabled: boolean; tone: string; type: string; length: string };
  active: boolean;
  autoPilot: boolean;
  content?: string;
  nextRunAt: number | null;
  postsCreated: number;
  createdAt: number;
}

export interface Engagement { likes: number; comments: number; shares: number; reach: number; rate: number; }

export interface Post {
  id: string;
  channelIds: string[];
  content: string;
  status: 'draft' | 'scheduled' | 'published';
  scheduledAt: number | null;
  publishedAt: number | null;
  campaignId: string | null;
  engagement: Engagement | null;
  createdAt: number;
}

export interface Activity { id: string; message: string; kind: string; at: number; }

export interface State {
  id: string;
  name: string;
  email: string;
  channels: Channel[];
  profile: Profile;
  resume: any;
  site: any;
  settings: { ai: { mode: string; provider: string; apiKey: string; baseUrl: string; model: string }; brand: { voice: string; emoji: string; signature: string } };
  platformCredentials: Record<string, { configured: boolean; extra?: any }>;
  campaigns: Campaign[];
  posts: Post[];
  activity: Activity[];
  fame: { history: { t: number; score: number; followers: number }[] };
}

export interface Dashboard {
  fameScore: number;
  channelsConnected: number;
  channelsEnabled: number;
  totalFollowers: number;
  postsPublished: number;
  postsScheduled: number;
  activeCampaigns: number;
  reach: number;
  engagementRate: number;
  upcoming: Post[];
  nextCampaignRuns: { id: string; name: string; at: number; channels: number }[];
  activity: Activity[];
  growth: { date: number; followers: number; engagement: number }[];
  lastPost: Post | null;
}
