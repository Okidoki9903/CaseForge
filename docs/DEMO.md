# Démo CaseForge — scénario de 60 à 90 secondes

Pour une première démonstration à un avocat, ou une vidéo LinkedIn. Données entièrement fictives (cabinet de démonstration).

**Préparation (30 s, hors caméra)**
- Lancer l'application (`npm run dev`) sur un dossier de données neuf, par exemple `CASEFORGE_DATA_DIR=/tmp/demo npm run dev`.
- Écran en 1440×900 ou plus, langue FR, session « Me Hélène Bouchard ».
- Fermer les notifications système déjà affichées.

La vidéo et les captures peuvent être régénérées automatiquement :

```bash
npm run build:web
npx vite preview --config vite.web.config.ts --port 4173 &
CASEFORGE_DEMO_VIDEO=./video npm run demo:capture    # captures dans docs/captures/demo-*.png
```

---

| Temps | À l'écran | Action | Ce qu'on dit |
|---|---|---|---|
| 0:00 – 0:10 | Écran d'accueil | « Passer » → « Commencer avec la démo » | « CaseForge, c'est votre cabinet en vue stratégique. Et tout reste sur ce poste : pas de nuage, aucune donnée transmise. » |
| 0:10 – 0:22 | Campus, bannière rouge, colonnes lumineuses | Montrer la bannière, puis un clic sur le KPI **Échéances critiques** | « Six échéances critiques, calculées en jours juridiques selon le ressort : Québec, Ontario, Cours fédérales. Impossible de les manquer, et la bannière ne se ferme pas. » |
| 0:22 – 0:35 | Centre d'alertes filtré | **Accuser réception** → initiales `HB` → Confirmer | « Pour la faire disparaître, il faut un accusé de réception signé de vos initiales. Tout est consigné au journal : en cas de réclamation, vous avez la preuve. » |
| 0:35 – 0:50 | Dossier en mode focus | « Voir sur la carte » → saisir `Révision du protocole`, `0,35` → Ajouter | « Le temps se saisit en cinq secondes : CaseForge arrondit au dixième d'heure, ici 0,4 h, et fige le taux. Le WIP est toujours visible en haut. » |
| 0:50 – 1:05 | Fenêtre Ctrl+K | `Ctrl+K` → taper `Patrick Belhumeur` | « Vérification de conflits : il est partie adverse dans un divorce que nous menons, et actionnaire d'un nouveau mandat. Conflit potentiel, enregistré automatiquement comme preuve de diligence. » |
| 1:05 – 1:20 | Barre de pipeline | Glisser la poignée du dossier vers « Audience » | « Le dossier avance d'une étape, par simple glisser-déposer, et l'historique garde qui l'a fait et quand. » |
| 1:20 – 1:30 | Vue d'ensemble | Fermer le panneau | « Délais, temps, conflits, pipeline : tout ce qui coûte cher quand on l'oublie, sur une seule carte et 100 % local. » |

**Questions fréquentes à anticiper**
- *Où sont mes données ?* Dans un fichier SQLite sur le poste, avec une sauvegarde quotidienne. Paramètres → Données en indique l'emplacement.
- *Et si je n'ai pas internet ?* Rien ne change : l'application n'en a jamais besoin.
- *Les délais sont-ils fiables ?* Les calendriers du Québec, de l'Ontario et des Cours fédérales ont été validés par un avocat. Chaque calcul affiche son raisonnement et son fondement légal. Ceux de la C.-B. et de l'Alberta restent à valider.

**Texte LinkedIn suggéré**

> Un délai de prescription manqué, c'est la première cause de réclamations en responsabilité professionnelle pour les avocats.
> J'ai construit CaseForge : le cabinet vu comme un jeu de stratégie, et 100 % local (aucun nuage, secret professionnel oblige).
> ✔ Échéances en jours juridiques (QC, ON, FED), avec accusé de réception nominatif
> ✔ Temps saisi en 5 secondes, arrondi au 0,1 h
> ✔ Conflits vérifiés en un raccourci, et tracés
> Démo de 75 secondes ci-dessous. Vos retours d'avocats sont les bienvenus.
