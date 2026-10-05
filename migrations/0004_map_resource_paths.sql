-- Update stored map asset paths after renaming public/ressources to public/resources.
UPDATE maps
SET image_path = '/resources/' || substr(image_path, length('/ressources/') + 1)
WHERE image_path LIKE '/ressources/%';