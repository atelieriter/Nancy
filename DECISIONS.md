# Nancy 3D — décisions

Projet autonome dans `nancy/`, séparé d’Apo Studio v3 : pas de bundler, pas de modification de `package.json`.

## Modèle
GPT-6 n’est pas disponible dans cet environnement. Construction faite ici, avec Three.js r184 vendorié depuis le repo parent.

## Données
- Emprise Overpass **48.6865, 6.1680, 48.7015, 6.1975** : assez large pour la gare à l’ouest, le canal à l’est, la Porte de la Craffe au nord, Saint-Sébastien / le marché au sud.
- Cache `data/nancy.json` (traces simplifiées) + `data/overpass-raw.json`. Relance : `python3 scripts/fetch_osm.py --force`.
- Origine carto : **Place Stanislas** (48.69361, 6.18306). X = est, Z = sud, Y = hauteur.

## Forme urbaine
- Extrusion réelle des polygones OSM (`building=*`), hauteurs via `height` / `building:levels`, sinon gabarit nancéien (R+3/R+4).
- **Vieux-Nancy** (nord de Stanislas) : calcaire plus chaud, type pierre de Jaumont / Euville.
- Toits **tuile terre cuite** (rouille / orange poussiéreux), comme le tapis vu d’Earth au-dessus de Stanislas — ardoise seulement sur églises et tours.
- Shader de **baies** en world-space : rythme vertical 18e, fenêtres allumées la nuit.
- L’Hôtel de Ville n’est pas nommé dans OSM (façade éclatée en petits volumes). Volume procédural au sud de Stanislas.
- L’**Opéra** n’existe pas non plus comme building nommé (seulement Grand Hôtel de la Reine / fragments). Construit en long pavillon zinc côté est, comme sur Earth — pas le cube OSM.
- Toits : deux pentes seulement si le plan OSM est assez rectangulaire ; sinon couvercle plat. Plus de tentes sur les L / îlots. Cap du cube enlevé. Zinc sur Stanislas.
- Voirie OSM : rues + ruelles (`path`) ; Rue Stanislas, Héré, Dominicains, Sainte-Catherine un peu plus larges. La place elle-même n’est pas redessinée en route.

## Lieux mis en valeur
Place Stanislas (dallage ocre + grilles dorées Jean Lamour), mairie/beffroi, Place de la Carrière, Palais du Gouvernement, Pépinière (arbres instanciés dans le polygone OSM), Saint-Epvre (flèche), cathédrale (deux tours), Saint-Sébastien, Marché Central, gare, portes (Craffe, Désilles, Saint-Georges et les autres `Porte *`), Place Carnot (emprise des ways OSM), canal.

## Vie
- Péniches en boucle sur le **centreline** du canal (polygone eau, bins par latitude).
- TGV sur les rails OSM filtrés autour de Nancy-Ville, aller-retour (entrée / sortie de gare).
- Grande roue fer/or sur la Place de la Carrière, face à l’axe Héré — souvenir des installations événementielles, pas un monument permanent.
- Nuit : fusées (spatioport), pas de feux d’artifice. Satellites en orbite.
- Accès Place Stanislas : ouvertures SW (Rue Stanislas) et SE (opposé) — Opéra/musée raccourcis.
- Trafic volant dense de 8 h à 20 h (voitures, scooters, pods). Cinq tours 2030 hors centre + **Urban Loop** : trois tours de verre (derrière la mairie, gare, canal) reliées par un train suspendu dans un tube.

## Lumière
Curseur 0–24 h : aube saumon, midi clair-lorrain, crépuscule, nuit bleue. La nuit : fenêtres, places et beffrois dorés (Stanislas, Carrière, Carnot, flèches, portes).

## Météo
« Petite pluie fine » : particules denses et lentes, vent léger d’ouest, soleil atténué, brouillard un peu plus lourd. Pas d’orage.

## Plateau
Le sol n’est plus un disque infini : c’est le **rectangle OSM** (48.6865–48.7015 N, 6.1680–6.1975 E), bordé d’un liseré clair, **extrudé vers le bas** (~96 m de terre à strates). Le vide autour est un fond studio gris, comme une coupe de ville posée sur une table.

## Interface
HUD type atlas contemporain : cartes blanches, coins arrondis, Inter + DM Mono, liste numérotée à gauche, barre d’heure en pastille en bas. La nuit retrouve le ciel.

## Technique
- `./run.sh` → `python3 -m http.server 3002`
- Three.js + OrbitControls locaux (pas de CDN runtime pour le moteur 3D).
- Géométries fusionnées par matériau pour rester autour de quelques draw calls malgré ~6800 bâtiments.
- Caméra orbitale amortie, polar max sous l’horizon pour ne pas passer sous le sol.
