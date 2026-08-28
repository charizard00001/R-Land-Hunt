export type HuntStatus = 'draft' | 'published' | 'live' | 'paused' | 'ended' | 'archived';
export type ProofPolicy = 'gps' | 'gps_code' | 'gps_photo' | 'qr';

export type Hint = {
  tier: number;
  cost: number;
  bought: boolean;
  text: string | null;
};

export type ActiveNode = {
  node_id: string;
  kind: string;
  seq: number;
  clue: string;
  proof: ProofPolicy;
  needs_code: boolean;
  wants_photo: boolean;
  is_terminal: boolean;
  base_points: number;
  hints_taken: number;
  hints: Hint[];
};

export type GameState = {
  ok: true;
  team: { id: string; name: string; score: number; finished_at: string | null };
  hunt: {
    id: string; name: string; status: HuntStatus;
    remaining_s: number; total_nodes: number;
  };
  solved: number;
  active: ActiveNode[];
} | { ok: false; reason: string };

export type Target = {
  node_id: string;
  distance_m: number;
  bearing_deg: number;
  in_range: boolean;
};

export type PingResult = { ok: true; targets: Target[] } | { ok: false; reason: string };

export type ArrivalResult =
  | { ok: true; points: number; first_blood: boolean; finished: boolean;
      finish_bonus: number; score: number }
  | { ok: false; reason: string; distance_m?: number; radius_m?: number; accuracy_m?: number };

export type HintResult =
  | { ok: true; tier: number; cost: number; text: string; score: number }
  | { ok: false; reason: string };

export type BoardRow = {
  rank: number; team_id: string; name: string; score: number;
  solved: number; hints: number; finished: boolean;
};

export type Crew = BoardRow & {
  lat: number | null; lng: number | null;
  last_seen_s: number | null; idle_s: number | null;
  trail: { lat: number; lng: number }[];
};

export type Alert = {
  kind: string; team_id: string; team: string; ago_s: number; body: string;
};

export type FeedItem = {
  kind: string; team: string | null; label: string | null;
  points: string | null; ago_s: number;
};

export type ControlState =
  | { ok: true;
      hunt: { id: string; name: string; status: HuntStatus; remaining_s: number; join_code: string };
      crews: Crew[]; alerts: Alert[]; feed: FeedItem[] }
  | { ok: false; reason: string };

export type PublicBoard =
  | { ok: true;
      hunt: { name: string; status: HuntStatus; remaining_s: number; crews: number };
      board: BoardRow[];
      feed: FeedItem[];
      per_clue: { label: string; seq: number; solved: number }[] }
  | { ok: false; reason: string };

export type NodeRow = {
  id: string; hunt_id: string; label: string; kind: string; clue: string;
  hints: { cost: number; text: string }[];
  lat: number | null; lng: number | null; radius_m: number;
  proof: ProofPolicy; site_code: string | null; base_points: number;
  is_start: boolean; is_terminal: boolean; seq: number;
};

export type EdgeRow = {
  hunt_id: string; from_node: string; to_node: string;
  unlock_rule: { type: 'all' } | { type: 'any_n'; n: number };
};

export type HuntRow = {
  id: string; org_id: string; name: string; join_code: string;
  status: HuntStatus; duration_s: number;
  started_at: string | null; created_at: string;
};

/** Human copy for every failure the engine can return. */
export const REASONS: Record<string, string> = {
  not_signed_in: 'Sign in first.',
  no_such_hunt: 'No hunt carries that cipher.',
  not_open_yet: 'That hunt has not opened for registration.',
  hunt_over: 'That hunt is already over.',
  registration_closed: 'The hunt has started — no new crews.',
  not_your_team: 'You are not aboard that crew.',
  not_active: 'That mark is not open to you.',
  not_running: 'The hunt is not running.',
  paused: 'The hunt is paused. Hold where you are.',
  time_up: 'Time is up.',
  too_far: 'Not here yet.',
  weak_fix: 'Your position is too vague. Wait for a better fix.',
  bad_code: 'That is not the code on the marker.',
  no_location_set: 'The organiser has not pinned this mark yet.',
  wrong_tier: 'Take the hints in order.',
  no_such_hint: 'There are no more hints for this mark.',
  forbidden: 'You do not have the rights for that.',
  no_start_node: 'Mark at least one clue as the opening mark first.',
  node_without_location: 'Every mark needs a location before you publish.',
  bad_transition: 'That is not possible from here.',
  nothing_active: 'That crew has no open mark.',
  not_public: 'No public board for this hunt.',
};

export function reasonText(reason: string | undefined): string {
  if (!reason) return 'Something went wrong.';
  return REASONS[reason] ?? reason.replace(/_/g, ' ');
}
