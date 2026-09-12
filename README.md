# Nancy 2030

Maquette 3D du centre de Nancy. Site statique (HTML / CSS / JS + Three.js), sans build.

## Local

```bash
./run.sh
```

Ouvre [http://localhost:3002](http://localhost:3002).

## Déploiement

En ligne : [nancy.atelieriter.com](https://nancy.atelieriter.com)

GitHub Pages, dossier racine, domaine `nancy.atelieriter.com`. Pas de build.

Le cache OSM `data/nancy.json` est versionné. Pour le régénérer :

```bash
python3 scripts/fetch_osm.py --force
```
