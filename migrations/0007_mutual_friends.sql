-- Existing follows become mutual.
INSERT OR IGNORE INTO follows (follower_id, followed_id, created_at)
SELECT followed_id, follower_id, created_at FROM follows;

-- Everyone who has played in the same match becomes friends.
INSERT OR IGNORE INTO follows (follower_id, followed_id, created_at)
SELECT a.player_id, b.player_id, MIN(m.started_at)
FROM competitor_members a
JOIN competitor_members b ON b.match_id = a.match_id AND b.player_id <> a.player_id
JOIN matches m ON m.id = a.match_id
GROUP BY a.player_id, b.player_id;
