-- "Actividad económica" pasa a ser una lista general (antes: texto libre + "Sector o industria",
-- muy enfocado en construcción). La tabla sectors guarda la lista; las empresas que ya eligieron
-- un sector antiguo lo conservan (queda inactivo y no se ofrece en el formulario).
insert into public.sectors (slug, names, sort_order, active) values
  ('agriculture', '{"es": "Agricultura, ganadería y pesca"}', 10, true),
  ('food-beverage', '{"es": "Alimentos y bebidas"}', 20, true),
  ('manufacturing', '{"es": "Manufactura e industria"}', 30, true),
  ('construction', '{"es": "Construcción e inmobiliaria"}', 40, true),
  ('wholesale-import', '{"es": "Comercio mayorista e importación"}', 50, true),
  ('retail', '{"es": "Comercio minorista y tiendas"}', 60, true),
  ('technology', '{"es": "Tecnología, software y telecomunicaciones"}', 70, true),
  ('electronics', '{"es": "Electrónica y electrodomésticos"}', 80, true),
  ('health', '{"es": "Salud, farmacia y equipos médicos"}', 90, true),
  ('hospitality', '{"es": "Hotelería, restaurantes y turismo"}', 100, true),
  ('logistics', '{"es": "Transporte y logística"}', 110, true),
  ('energy-mining', '{"es": "Energía y minería"}', 120, true),
  ('automotive', '{"es": "Automotriz y repuestos"}', 130, true),
  ('textile-fashion', '{"es": "Textil, moda y calzado"}', 140, true),
  ('furniture-home', '{"es": "Muebles, decoración y hogar"}', 150, true),
  ('beauty', '{"es": "Belleza y cuidado personal"}', 160, true),
  ('education', '{"es": "Educación"}', 170, true),
  ('professional-services', '{"es": "Servicios profesionales (consultoría, arquitectura, diseño)"}', 180, true),
  ('public-nonprofit', '{"es": "Gobierno y organizaciones sin fines de lucro"}', 190, true),
  ('other', '{"es": "Otra"}', 999, true)
on conflict (slug) do update set names = excluded.names, sort_order = excluded.sort_order, active = true;

update public.sectors set active = false
where slug in ('architecture-design', 'distribution-hardware', 'real-estate');
