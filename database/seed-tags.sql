-- =============================================
-- SEED: tags
-- type 1 = Ambientes | 2 = Servicios | 3 = Extras | 4 = Facilidades
-- =============================================

INSERT INTO tags (id, name, type, is_active) VALUES

-- ── Ambientes (type 1) ──────────────────────────────────────────────────────
(1,  'Altillo',                             1, true),
(2,  'Balcón',                              1, true),
(3,  'Baulera',                             1, true),
(4,  'Cocina',                              1, true),
(5,  'Comedor',                             1, true),
(6,  'Comedor diario',                      1, true),
(7,  'Dependencia de servicio',             1, true),
(8,  'Dormitorio en suite',                 1, true),
(9,  'Escritorio',                          1, true),
(10, 'Hall',                                1, true),
(11, 'Jardín',                              1, true),
(12, 'Lavadero',                            1, true),
(13, 'Living',                              1, true),
(14, 'Living comedor',                      1, true),
(15, 'Oficinas',                            1, true),
(16, 'Patio',                               1, true),
(17, 'Sótano',                              1, true),
(18, 'Terraza',                             1, true),
(19, 'Vestidor',                            1, true),
(20, 'Vestuarios',                          1, true),

-- ── Servicios (type 2) ──────────────────────────────────────────────────────
(21, 'Ascensor',                            2, true),
(22, 'Caja fuerte',                         2, true),
(23, 'Encargado',                           2, true),
(24, 'Internet/Wifi',                       2, true),
(25, 'Laundry',                             2, true),
(26, 'Ropa de cama',                        2, true),
(27, 'Servicio de limpieza',                2, true),
(28, 'Toallas',                             2, true),

-- ── Extras (type 3) ─────────────────────────────────────────────────────────
(29, 'Aire acondicionado',                  3, true),
(30, 'Alarma',                              3, true),
(31, 'Amoblado',                            3, true),
(32, 'Caldera',                             3, true),
(33, 'Calefacción',                         3, true),
(34, 'Cancha de deportes',                  3, true),
(35, 'Cocina equipada',                     3, true),
(36, 'Frigobar',                            3, true),
(37, 'Fuerza motriz',                       3, true),
(38, 'Grupo electrógeno',                   3, true),
(39, 'Grúa',                                3, true),
(40, 'Lavarropas',                          3, true),
(41, 'Lavavajillas',                        3, true),
(42, 'Microondas',                          3, true),
(43, 'Montacarga',                          3, true),
(44, 'Motores',                             3, true),
(45, 'Plaza de maniobras',                  3, true),
(46, 'Quincho',                             3, true),
(47, 'Sauna',                               3, true),
(48, 'Secarropas',                          3, true),
(49, 'SUM',                                 3, true),
(50, 'Termotanque',                         3, true),
(51, 'Vigilancia',                          3, true),

-- ── Facilidades (type 4) ────────────────────────────────────────────────────
(52, 'Acceso para personas con discapacidad', 4, true),
(53, 'Apto profesional',                    4, true),
(54, 'Gimnasio',                            4, true),
(55, 'Hidromasaje',                         4, true),
(56, 'Parrilla',                            4, true),
(57, 'Permite mascotas',                    4, true),
(58, 'Pileta',                              4, true),
(59, 'Sala de juegos',                      4, true),
(60, 'Solarium',                            4, true),
(61, 'Uso comercial',                       4, true);

-- Reset the sequence so future INSERTs auto-increment from 62 onwards
SELECT setval('tags_id_seq', 61);
