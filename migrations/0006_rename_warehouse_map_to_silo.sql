-- Replace the map ID while preserving matches that reference it.
-- Use a temporary unique name and sort order because both columns are unique.
INSERT INTO maps (id, name, sort_order, image_path)
SELECT 'silo', 'Silo (migration)', -1, '/resources/maps/07_Silo.png'
FROM maps
WHERE id = 'warehouse';

UPDATE matches
SET map_id = 'silo'
WHERE map_id = 'warehouse';

DELETE FROM maps
WHERE id = 'warehouse';

UPDATE maps
SET name = 'Silo', sort_order = 8
WHERE id = 'silo';
