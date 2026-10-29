-- Canonical artwork: frontend/public/maps/ATTRIBUTION.md (setpos.gg, CC BY 4.0).
insert into public.maps(id,name,radar) values
('mirage','Mirage','{"imageUrl":"/maps/mirage.svg","width":1024,"height":1024,"coordinateVersion":"setpos-mirage-ba5f793"}'),
('inferno','Inferno','{"imageUrl":"/maps/inferno.svg","width":1024,"height":1024,"coordinateVersion":"setpos-inferno-ba5f793"}'),
('ancient','Ancient','{"imageUrl":"/maps/ancient.svg","width":1024,"height":1024,"coordinateVersion":"setpos-ancient-ba5f793"}')
on conflict(id) do nothing;
