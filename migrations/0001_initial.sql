CREATE TABLE user (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  emailVerified INTEGER NOT NULL DEFAULT 0,
  image TEXT,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL,
  username TEXT UNIQUE COLLATE NOCASE,
  displayUsername TEXT
);

CREATE TABLE session (
  id TEXT PRIMARY KEY NOT NULL,
  expiresAt INTEGER NOT NULL,
  token TEXT NOT NULL UNIQUE,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL,
  ipAddress TEXT,
  userAgent TEXT,
  userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE
);

CREATE INDEX session_user_id_idx ON session(userId);

CREATE TABLE account (
  id TEXT PRIMARY KEY NOT NULL,
  accountId TEXT NOT NULL,
  providerId TEXT NOT NULL,
  userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  accessToken TEXT,
  refreshToken TEXT,
  idToken TEXT,
  accessTokenExpiresAt INTEGER,
  refreshTokenExpiresAt INTEGER,
  scope TEXT,
  password TEXT,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);

CREATE INDEX account_user_id_idx ON account(userId);

CREATE TABLE verification (
  id TEXT PRIMARY KEY NOT NULL,
  identifier TEXT NOT NULL,
  value TEXT NOT NULL,
  expiresAt INTEGER NOT NULL,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);

CREATE INDEX verification_identifier_idx ON verification(identifier);

CREATE TABLE maps (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL UNIQUE,
  image_path TEXT NOT NULL
);

INSERT INTO maps (id, name, sort_order, image_path) VALUES
  ('metro', 'Metro', 1, '/ressources/maps/00_Metro.png'),
  ('ss-royale', 'SS Royale', 2, '/ressources/maps/01_SS_Royale.png'),
  ('mansion', 'Mansion', 3, '/ressources/maps/02_Mansion.png'),
  ('plaza', 'Plaza', 4, '/ressources/maps/03_Plaza.png'),
  ('factory', 'Factory', 5, '/ressources/maps/04_Factory.png'),
  ('theme-park', 'Theme Park', 6, '/ressources/maps/05_Theme_Park.png'),
  ('powerplant', 'PowerPlant', 7, '/ressources/maps/06_PowerPlant.png'),
  ('warehouse', 'Warehouse', 8, '/ressources/maps/07_Warehouse.png'),
  ('library', 'Library', 9, '/ressources/maps/08_Library.png'),
  ('nightclub', 'Nightclub', 10, '/ressources/maps/09_Nightclub.png'),
  ('zoo', 'Zoo', 11, '/ressources/maps/10_Zoo.png'),
  ('swift-peaks', 'Swift Peaks', 12, '/ressources/maps/11_Swift_Peaks.png'),
  ('casino', 'Casino', 13, '/ressources/maps/12_Casino.png'),
  ('festival', 'Festival', 14, '/ressources/maps/13_Festival.png'),
  ('resort', 'Resort', 15, '/ressources/maps/14_Resort.png'),
  ('airport', 'Airport', 16, '/ressources/maps/15_Airport.png'),
  ('laboratory', 'Laboratory', 17, '/ressources/maps/16_Laboratory.png');

CREATE TABLE follows (
  follower_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  followed_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY (follower_id, followed_id),
  CHECK (follower_id <> followed_id)
);

CREATE INDEX follows_followed_idx ON follows(followed_id, follower_id);

CREATE TABLE matches (
  id TEXT PRIMARY KEY NOT NULL,
  creator_id TEXT NOT NULL REFERENCES user(id),
  map_id TEXT REFERENCES maps(id),
  status TEXT NOT NULL CHECK (status IN ('active', 'awaiting-map', 'completed', 'abandoned')),
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  winner_competitor_id TEXT,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  abandoned_at TEXT,
  created_at TEXT NOT NULL,
  CHECK (status <> 'completed' OR (map_id IS NOT NULL AND completed_at IS NOT NULL)),
  CHECK (status <> 'abandoned' OR abandoned_at IS NOT NULL)
);

CREATE INDEX matches_creator_status_idx ON matches(creator_id, status, started_at DESC);

CREATE TABLE competitors (
  id TEXT PRIMARY KEY NOT NULL,
  match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('solo', 'team')),
  sort_order INTEGER NOT NULL,
  UNIQUE (match_id, id),
  UNIQUE (match_id, sort_order)
);

CREATE TABLE competitor_members (
  match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  competitor_id TEXT NOT NULL,
  player_id TEXT NOT NULL REFERENCES user(id),
  sort_order INTEGER NOT NULL,
  PRIMARY KEY (match_id, player_id),
  UNIQUE (competitor_id, sort_order),
  FOREIGN KEY (match_id, competitor_id) REFERENCES competitors(match_id, id) ON DELETE CASCADE
);

CREATE INDEX competitor_members_player_idx ON competitor_members(player_id, match_id);

CREATE TABLE rounds (
  id TEXT PRIMARY KEY NOT NULL,
  match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  sequence INTEGER NOT NULL CHECK (sequence > 0),
  submission_id TEXT NOT NULL,
  input_hash TEXT NOT NULL,
  winner_competitor_id TEXT NOT NULL,
  survivor_count INTEGER NOT NULL CHECK (survivor_count IN (1, 2)),
  created_at TEXT NOT NULL,
  undone INTEGER NOT NULL DEFAULT 0 CHECK (undone IN (0, 1)),
  UNIQUE (match_id, sequence),
  UNIQUE (match_id, submission_id),
  FOREIGN KEY (match_id, winner_competitor_id) REFERENCES competitors(match_id, id)
);

CREATE INDEX rounds_match_order_idx ON rounds(match_id, sequence);

CREATE TABLE point_attributions (
  round_id TEXT NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL REFERENCES user(id),
  points INTEGER NOT NULL CHECK (points = 1),
  PRIMARY KEY (round_id, player_id)
);

CREATE INDEX point_attributions_player_idx ON point_attributions(player_id, round_id);

CREATE TABLE round_undos (
  round_id TEXT PRIMARY KEY NOT NULL REFERENCES rounds(id),
  actor_id TEXT NOT NULL REFERENCES user(id),
  undone_at TEXT NOT NULL,
  correction INTEGER NOT NULL DEFAULT 0 CHECK (correction IN (0, 1))
);
