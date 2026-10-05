-- Update stored profile picture paths after renaming public/ressources to public/resources.
UPDATE user
SET image = '/resources/' || substr(image, length('/ressources/') + 1)
WHERE image LIKE '/ressources/%';