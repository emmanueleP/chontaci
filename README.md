# 📱 ContaCarbo - Calcolatore Carboidrati & Bolo Diabete per iPhone

**ContaCarbo** è una Web App progressiva (PWA) moderna, veloce e completamente ottimizzata per **iPhone** e Safari iOS, pensata specificamente per chi gestisce il diabete e deve calcolare la **conta dei carboidrati (CHO)** e il **bolo insulinico**.

L'applicazione è progettata per essere ospitata gratuitamente e in 2 minuti su **GitHub Pages** senza necessità di configurare server o processi di compilazione complessi.

---

## ✨ Funzionalità Principali

- 🍽️ **Compositore Pasto in Tempo Reale**: Aggiungi uno o più alimenti, regola i grammi con comodi pulsanti steppers (`-10g`, `-1g`, `+1g`, `+10g`) o porzioni preimpostate (standard, mezza, doppia) e ottieni istantaneamente i grammi di carboidrati totali (CHO), calorie, zuccheri, proteine e grassi.
- 💉 **Calcolatore Bolo Insulina**:
  - Rapporto Insulina/Carboidrati (ICR) configurabile individualmente per **Colazione, Pranzo, Cena e Spuntino**.
  - Inserimento opzionale della **Glicemia Attuale (mg/dL)** con calcolo automatico del bolo di correzione basato sul proprio Fattore di Sensibilità (ISF) e Target Glicemico.
  - Indicatore cromatico dello stato glicemico (Verde = a target, Giallo = moderata, Rosso = alta, Avviso sonoro/visivo = ipoglicemia < 70 mg/dL).
  - Trasparenza totale delle formule matematiche utilizzate.
  - Toggle nelle impostazioni per disattivare la stima dell'insulina se si desidera solo il conteggio dei carboidrati.
- 📚 **Database Alimenti Completo**:
  - Oltre 75+ alimenti italiani ed internazionali (CREA/INRAN) suddivisi in categorie: Pane e Forno, Pasta e Cereali (pesi crudi e cotti), Frutta, Verdure, Legumi, Latticini, Dolci e Snack, Bevande, Piatti Composti (Pizza, Hamburger, Sushi, Lasagna) e alimenti a 0g CHO (Carne, Pesce, Uova, Olio EVO).
  - Ricerca istantanea dal vivo con evidenziazione.
  - Segnalibro ⭐ **Preferiti** per avere sempre a portata di mano gli alimenti quotidiani.
- ➕ **Alimenti Personalizzati**: Crea e salva qualsiasi alimento non presente nel database (con porzione, carboidrati per 100g, categoria e macronutrienti).
- 📖 **Diario & Pasti Frequenti**: Salva i tuoi pasti registrati con orario e data, oppure salva combinazioni abituali (es. *"Colazione fette biscottate e marmellata"*) per ricaricarle nel piatto in un tocco.
- 💾 **Backup & Ripristino (JSON)**: Esporta e importa tutti i tuoi dati con un clic per non perdere mai nulla.
- 🎨 **Design iOS 18 Glassmorphism**:
  - Supporto per Safe Area (Dynamic Island / notch e barra Home di iPhone).
  - Modalità Scura (Dark Mode) e Chiara (Light Mode).
  - 100% Offline grazie al **Service Worker** integrato.

---

## 🚀 Come Pubblicare su GitHub Pages (in 2 minuti)

I file sono già pronti nella cartella principale (`index.html`, `style.css`, `app.js`, `manifest.json`, ecc.).

### Passo 1: Inizializza Git e Fai il Commit

Apri il terminale (o PowerShell) in questa cartella:

```bash
git init
git add .
git commit -m "Prima versione ContaCarbo PWA"
git branch -M main
```

### Passo 2: Crea un Repository su GitHub

1. Vai su [github.com](https://github.com/) e clicca su **New Repository**.
2. Assegna un nome al repository (ad esempio `contacarbo`).
3. Scegli **Public** e clicca su **Create repository**.

### Passo 3: Collega ed Invia i File

Copia i comandi mostrati da GitHub ed eseguili nel terminale:

```bash
git remote add origin https://github.com/<tuo-username>/contacarbo.git
git push -u origin main
```

*(Sostituisci `<tuo-username>` con il tuo nome utente di GitHub)*

### Passo 4: Attiva GitHub Pages

1. Sul tuo repository GitHub, vai su **Settings** (la scheda in alto a destra).
2. Nel menu laterale a sinistra, clicca su **Pages**.
3. Sotto **Build and deployment**:
   - **Source**: seleziona *Deploy from a branch*
   - **Branch**: seleziona `main` e la cartella `/ (root)`
   - Clicca su **Save**.

🎉 Entro circa 60 secondi la tua app sarà online all'indirizzo:
`https://<tuo-username>.github.io/contacarbo/`

---

## 📱 Come Installare l'App su iPhone

Per avere un'esperienza identica ad un'app nativa scaricata dall'App Store:

1. **Apri il link** di GitHub Pages su **Safari** sul tuo iPhone.
2. Tocca l'icona **Condividi** in basso (il quadrato con la freccia rivolta verso l'alto ⬆️).
3. Scorri il menu verso il basso e tocca **"Aggiungi alla schermata Home"**.
4. Tocca **"Aggiungi"** in alto a destra.

L'icona personalizzata di **ContaCarbo** comparirà sulla schermata principale del tuo iPhone:
- Si aprirà a schermo intero senza barre degli indirizzi.
- Funzionerà anche in modalità aereo o senza connessione dati.

---

## ⚠️ Avvertenza Medica

Questa applicazione è uno strumento di ausilio al calcolo matematico della stima dei carboidrati e dell'insulina. **Non costituisce dispositivo medico né consulenza clinica.** I parametri di terapia (Rapporto Insulina/Carboidrati ICR, Fattore di Sensibilità ISF e Target Glicemico) devono essere sempre concordati e prescritti dal proprio diabetologo curante.
