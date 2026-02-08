/**
 * Service de génération HTML
 */

import * as fs from "fs";
import { HTML_CONFIG, CACHE_DIR } from "../config";
import { Movie } from "../models";
import { formatTime, formatDuration, escapeHtml } from "../utils";
import { ensureCacheDir } from "./cache.service";

/**
 * Génère une page HTML avec les films organisés par jour et par chaîne
 */
export function generateHtmlPage(movies: Movie[], moviesByDay: Map<string, Movie[]>): void {
    ensureCacheDir();

    // Organiser les films par jour puis par chaîne
    const moviesByDayAndChannel = new Map<string, Map<string, Movie[]>>();
    for (const [day, dayMovies] of moviesByDay) {
        const byChannel = new Map<string, Movie[]>();
        for (const movie of dayMovies) {
            if (!byChannel.has(movie.channel)) {
                byChannel.set(movie.channel, []);
            }
            byChannel.get(movie.channel)!.push(movie);
        }
        const sortedByChannel = new Map([...byChannel.entries()].sort((a, b) => b[1].length - a[1].length));
        moviesByDayAndChannel.set(day, sortedByChannel);
    }

    // Générer le contenu des sections
    const sectionsHtml = generateSectionsHtml(moviesByDayAndChannel);
    const cssStyles = generateCssStyles();
    const jsScript = generateJsScript();

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>📺 Films TV - Programme</title>
    <style>${cssStyles}</style>
</head>
<body>
    <header>
        <div class="stats">
            <span class="stat">📺 ${movies.length} film(s)</span>
            <span class="stat">📅 ${moviesByDay.size} jour(s)</span>
            <span class="stat">🔄 ${new Date().toLocaleString("fr-FR")}</span>
            <div class="freebox-status" id="freeboxStatus" onclick="showFreeboxModal()">
                <span class="indicator"></span>
                <span class="status-text">Freebox</span>
            </div>
        </div>
    </header>
    <main>${sectionsHtml}</main>
    <div class="modal" id="freeboxModal">
        <div class="modal-content">
            <h2>📡 Connexion Freebox</h2>
            <p id="freeboxModalText">Vérification...</p>
            <div class="modal-buttons">
                <button class="btn-secondary" onclick="closeFreeboxModal()">Fermer</button>
                <button class="btn-primary" id="freeboxActionBtn" onclick="freeboxAction()">Autoriser</button>
            </div>
        </div>
    </div>
    <div class="toast-container" id="toastContainer"></div>
    <footer>
        <p>Généré depuis les données XMLTV • ${new Date().toLocaleDateString("fr-FR", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
        <p style="margin-top: 0.5rem;">💡 Pour l'enregistrement Freebox: <code>npm run server</code></p>
    </footer>
    <script>${jsScript}</script>
</body>
</html>`;

    fs.writeFileSync(HTML_CONFIG.outputFile, html, "utf-8");
    console.log(`\n🌐 Page HTML générée: ${HTML_CONFIG.outputFile}`);
}

/**
 * Génère le HTML des sections (jours et chaînes)
 */
function generateSectionsHtml(moviesByDayAndChannel: Map<string, Map<string, Movie[]>>): string {
    let sectionsHtml = "";

    for (const [day, channelMovies] of moviesByDayAndChannel) {
        const dayTotal = [...channelMovies.values()].reduce((sum, m) => sum + m.length, 0);
        let channelsHtml = "";

        for (const [channel, channelMovieList] of channelMovies) {
            const moviesHtml = generateMoviesHtml(day, channel, channelMovieList);
            channelsHtml += `
            <div class="channel-section">
                <div class="channel-header">
                    <h3>📺 ${channel}</h3>
                    <span class="channel-count">${channelMovieList.length} film(s)</span>
                </div>
                <div class="movies-grid">${moviesHtml}</div>
            </div>`;
        }

        sectionsHtml += `
        <section class="day-section">
            <div class="day-header">
                <h2>📅 ${day}</h2>
                <span class="day-count">${dayTotal} film(s)</span>
            </div>
            ${channelsHtml}
        </section>`;
    }

    return sectionsHtml;
}

/**
 * Génère le HTML des cartes de films
 */
function generateMoviesHtml(day: string, channel: string, movies: Movie[]): string {
    let moviesHtml = "";

    movies.forEach((movie, idx) => {
        const movieId = `movie_${day.replace(/[^a-z0-9]/gi, '_')}_${channel.replace(/[^a-z0-9]/gi, '_')}_${idx}`;
        const startTs = Math.floor(movie.startDate.getTime() / 1000);
        const endTs = Math.floor(movie.endDate.getTime() / 1000);
        const safeName = escapeHtml(movie.name).replace(/'/g, "\\'");
        const safeChannel = escapeHtml(channel).replace(/'/g, "\\'");

        const posterHtml = movie.icon
            ? `<img class="movie-poster" src="${movie.icon}" alt="${escapeHtml(movie.name)}" loading="lazy" onerror="this.outerHTML='<div class=movie-poster placeholder>🎬</div>'">`
            : `<div class="movie-poster placeholder">🎬</div>`;

        const categoriesHtml = movie.categories.map(cat => `<span class="category-tag">${escapeHtml(cat)}</span>`).join("");

        moviesHtml += `
        <article class="movie-card">
            ${posterHtml}
            <div class="movie-content">
                <h4 class="movie-title">
                    ${escapeHtml(movie.name)}
                    ${movie.year ? `<span class="movie-year">(${movie.year})</span>` : ""}
                </h4>
                ${movie.subtitle ? `<p class="movie-subtitle">${escapeHtml(movie.subtitle)}</p>` : ""}
                <div class="movie-meta">
                    <span class="movie-time">🕐 ${formatTime(movie.startDate)}</span>
                    <span class="movie-duration">${formatDuration(movie.startDate, movie.endDate)}</span>
                    ${movie.rating ? `<span class="movie-rating">👥 ${escapeHtml(movie.rating)}</span>` : ""}
                </div>
                <div class="movie-categories">${categoriesHtml}</div>
                ${movie.country ? `<p class="movie-info">🌍 ${escapeHtml(movie.country)}</p>` : ""}
                ${movie.directors && movie.directors.length > 0 ? `<p class="movie-info"><strong>Réalisateur:</strong> ${escapeHtml(movie.directors.join(", "))}</p>` : ""}
                ${movie.actors && movie.actors.length > 0 ? `<p class="movie-info"><strong>Avec:</strong> ${escapeHtml(movie.actors.slice(0, 4).join(", "))}${movie.actors.length > 4 ? "..." : ""}</p>` : ""}
                ${movie.description ? `<p class="movie-description">${escapeHtml(movie.description)}</p>` : ""}
                <button class="btn-record" id="${movieId}" onclick="recordMovie('${movieId}', '${safeName}', '${safeChannel}', ${startTs}, ${endTs})">
                    ⏺️ Enregistrer sur Freebox
                </button>
            </div>
        </article>`;
    });

    return moviesHtml;
}

/**
 * Génère les styles CSS
 */
function generateCssStyles(): string {
    return `
        :root {
            --bg-primary: #0f0f0f;
            --bg-secondary: #1a1a1a;
            --bg-card: #252525;
            --bg-hover: #303030;
            --text-primary: #ffffff;
            --text-secondary: #a0a0a0;
            --accent: #e50914;
            --accent-hover: #f40612;
            --border: #333;
            --gradient-start: #e50914;
            --gradient-end: #b20710;
            --success: #27ae60;
            --warning: #f39c12;
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: var(--bg-primary); color: var(--text-primary); line-height: 1.6; }
        header { background: linear-gradient(135deg, var(--gradient-start), var(--gradient-end)); padding: 1rem; text-align: center; position: sticky; top: 0; z-index: 100; box-shadow: 0 4px 20px rgba(0,0,0,0.5); }
        .stats { display: flex; justify-content: center; gap: 1rem; flex-wrap: wrap; align-items: center; }
        .stat { background: rgba(255,255,255,0.15); padding: 0.5rem 1rem; border-radius: 20px; font-size: 0.9rem; }
        .freebox-status { display: flex; align-items: center; gap: 0.5rem; background: rgba(0,0,0,0.3); padding: 0.5rem 1rem; border-radius: 20px; cursor: pointer; transition: background 0.2s; }
        .freebox-status:hover { background: rgba(0,0,0,0.5); }
        .freebox-status .indicator { width: 10px; height: 10px; border-radius: 50%; background: var(--warning); }
        .freebox-status.connected .indicator { background: var(--success); }
        .freebox-status.error .indicator { background: var(--accent); }
        main { max-width: 1400px; margin: 0 auto; padding: 2rem; }
        .day-section { margin-bottom: 3rem; }
        .day-header { background: var(--bg-secondary); padding: 1rem 1.5rem; border-radius: 12px; margin-bottom: 1.5rem; border-left: 4px solid var(--accent); display: flex; justify-content: space-between; align-items: center; }
        .day-header h2 { font-size: 1.5rem; text-transform: capitalize; }
        .day-count { background: var(--accent); padding: 0.3rem 0.8rem; border-radius: 15px; font-size: 0.85rem; }
        .channel-section { margin-bottom: 2rem; margin-left: 1rem; }
        .channel-header { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 1px solid var(--border); }
        .channel-header h3 { font-size: 1.2rem; color: var(--text-secondary); }
        .channel-count { background: var(--bg-hover); padding: 0.2rem 0.6rem; border-radius: 10px; font-size: 0.75rem; color: var(--text-secondary); }
        .movies-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1.25rem; }
        .movie-card { background: var(--bg-card); border-radius: 12px; overflow: hidden; transition: transform 0.2s, box-shadow 0.2s; border: 1px solid var(--border); }
        .movie-card:hover { transform: translateY(-4px); box-shadow: 0 8px 25px rgba(0,0,0,0.4); border-color: var(--accent); }
        .movie-poster { width: 100%; height: 180px; object-fit: cover; background: var(--bg-hover); }
        .movie-poster.placeholder { display: flex; align-items: center; justify-content: center; font-size: 4rem; color: var(--text-secondary); }
        .movie-content { padding: 1rem; }
        .movie-title { font-size: 1.1rem; font-weight: 600; margin-bottom: 0.25rem; }
        .movie-year { color: var(--accent); }
        .movie-subtitle { font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.5rem; font-style: italic; }
        .movie-meta { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.75rem; }
        .movie-time { background: var(--accent); color: white; padding: 0.25rem 0.6rem; border-radius: 6px; font-size: 0.8rem; font-weight: 600; }
        .movie-duration, .movie-rating { background: var(--bg-hover); padding: 0.25rem 0.6rem; border-radius: 6px; font-size: 0.8rem; color: var(--text-secondary); }
        .movie-rating { background: #2d5a27; color: white; }
        .movie-categories { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-bottom: 0.75rem; }
        .category-tag { background: var(--bg-hover); padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.7rem; color: var(--text-secondary); }
        .movie-info { font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.5rem; }
        .movie-info strong { color: var(--text-primary); }
        .movie-description { font-size: 0.85rem; color: var(--text-secondary); display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
        .btn-record { width: 100%; margin-top: 0.75rem; padding: 0.6rem 1rem; border: none; border-radius: 8px; background: linear-gradient(135deg, #3498db, #2980b9); color: white; font-size: 0.85rem; font-weight: 600; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 0.5rem; }
        .btn-record:hover { background: linear-gradient(135deg, #2980b9, #1f6dad); transform: scale(1.02); }
        .btn-record:disabled { background: var(--bg-hover); cursor: not-allowed; transform: none; }
        .btn-record.recording { background: linear-gradient(135deg, var(--success), #1e8449); }
        .btn-record.error { background: linear-gradient(135deg, var(--accent), var(--gradient-end)); }
        .modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 1000; align-items: center; justify-content: center; }
        .modal.active { display: flex; }
        .modal-content { background: var(--bg-secondary); padding: 2rem; border-radius: 16px; max-width: 500px; width: 90%; text-align: center; }
        .modal-content h2 { margin-bottom: 1rem; }
        .modal-content p { color: var(--text-secondary); margin-bottom: 1.5rem; line-height: 1.8; }
        .modal-buttons { display: flex; gap: 1rem; justify-content: center; }
        .modal-buttons button { padding: 0.75rem 1.5rem; border: none; border-radius: 8px; font-size: 1rem; cursor: pointer; }
        .btn-primary { background: var(--accent); color: white; }
        .btn-primary:hover { background: var(--accent-hover); }
        .btn-secondary { background: var(--bg-hover); color: var(--text-primary); }
        .toast-container { position: fixed; bottom: 2rem; right: 2rem; z-index: 1001; display: flex; flex-direction: column; gap: 0.5rem; }
        .toast { background: var(--bg-secondary); padding: 1rem 1.5rem; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.3); animation: slideIn 0.3s ease; border-left: 4px solid var(--accent); }
        .toast.success { border-left-color: var(--success); }
        .toast.error { border-left-color: var(--accent); }
        @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        footer { text-align: center; padding: 2rem; color: var(--text-secondary); font-size: 0.85rem; border-top: 1px solid var(--border); }
        footer code { background: var(--bg-hover); padding: 0.2rem 0.5rem; border-radius: 4px; }
        @media (max-width: 768px) { main { padding: 1rem; } .movies-grid { grid-template-columns: 1fr; } .toast-container { left: 1rem; right: 1rem; } }
    `;
}

/**
 * Génère le script JavaScript
 */
function generateJsScript(): string {
    return `
        const API_URL = '${HTML_CONFIG.apiUrl}';
        let authPending = false;
        
        async function checkFreeboxStatus() {
            const el = document.getElementById('freeboxStatus');
            const txt = el.querySelector('.status-text');
            try {
                const r = await fetch(API_URL + '/status');
                const d = await r.json();
                if (d.success && d.connected) {
                    el.classList.add('connected');
                    el.classList.remove('error');
                    txt.textContent = 'Freebox ✓';
                } else {
                    el.classList.remove('connected');
                    txt.textContent = 'Freebox';
                }
            } catch (e) {
                el.classList.add('error');
                txt.textContent = 'Serveur off';
            }
        }
        
        function showFreeboxModal() {
            document.getElementById('freeboxModal').classList.add('active');
            checkModalStatus();
        }
        
        function closeFreeboxModal() {
            document.getElementById('freeboxModal').classList.remove('active');
        }
        
        async function checkModalStatus() {
            const txt = document.getElementById('freeboxModalText');
            const btn = document.getElementById('freeboxActionBtn');
            txt.textContent = 'Vérification...';
            btn.style.display = 'none';
            try {
                const r = await fetch(API_URL + '/status');
                const d = await r.json();
                if (d.success && d.connected) {
                    txt.textContent = '✅ Connecté! Vous pouvez programmer des enregistrements.';
                } else {
                    txt.innerHTML = '⚠️ Non connecté.<br><br>Cliquez sur "Autoriser" puis validez sur votre Freebox.';
                    btn.textContent = 'Autoriser';
                    btn.style.display = 'block';
                    authPending = false;
                }
            } catch (e) {
                txt.innerHTML = '❌ Serveur non démarré.<br><br>Lancez: <code>npm run server</code>';
            }
        }
        
        async function freeboxAction() {
            const txt = document.getElementById('freeboxModalText');
            const btn = document.getElementById('freeboxActionBtn');
            btn.disabled = true;
            if (!authPending) {
                txt.textContent = 'Demande en cours...';
                try {
                    const r = await fetch(API_URL + '/authorize', { method: 'POST' });
                    const d = await r.json();
                    if (d.success) {
                        txt.innerHTML = '📺 <strong>Regardez votre Freebox!</strong><br><br>Appuyez sur ➡️ pour autoriser, puis cliquez "Vérifier".';
                        btn.textContent = 'Vérifier';
                        authPending = true;
                    } else {
                        txt.textContent = '❌ ' + d.error;
                    }
                } catch (e) {
                    txt.textContent = '❌ Erreur de connexion';
                }
            } else {
                txt.textContent = 'Vérification...';
                try {
                    const r = await fetch(API_URL + '/authorize/status');
                    const d = await r.json();
                    if (d.status === 'granted') {
                        txt.textContent = '✅ Autorisé! Vous pouvez enregistrer.';
                        btn.style.display = 'none';
                        authPending = false;
                        checkFreeboxStatus();
                    } else if (d.status === 'pending') {
                        txt.innerHTML = '⏳ En attente...<br>Validez sur la Freebox.';
                    } else {
                        txt.textContent = '❌ ' + d.message;
                        btn.textContent = 'Réessayer';
                        authPending = false;
                    }
                } catch (e) {
                    txt.textContent = '❌ Erreur';
                }
            }
            btn.disabled = false;
        }
        
        async function recordMovie(id, name, channel, start, end) {
            const btn = document.getElementById(id);
            const orig = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '⏳ Programmation...';
            try {
                const r = await fetch(API_URL + '/record', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ channelId: channel, channelName: channel, start, end, name })
                });
                const d = await r.json();
                if (d.success) {
                    btn.innerHTML = '✅ Programmé!';
                    btn.classList.add('recording');
                    showToast('✅ ' + d.message, 'success');
                } else {
                    btn.innerHTML = '❌ Erreur';
                    btn.classList.add('error');
                    showToast('❌ ' + d.error, 'error');
                    setTimeout(() => { btn.innerHTML = orig; btn.classList.remove('error'); btn.disabled = false; }, 3000);
                }
            } catch (e) {
                btn.innerHTML = '❌ Serveur off';
                btn.classList.add('error');
                showToast('❌ Lancez le serveur: npm run server', 'error');
                setTimeout(() => { btn.innerHTML = orig; btn.classList.remove('error'); btn.disabled = false; }, 3000);
            }
        }
        
        function showToast(msg, type) {
            const c = document.getElementById('toastContainer');
            const t = document.createElement('div');
            t.className = 'toast ' + type;
            t.innerHTML = msg;
            c.appendChild(t);
            setTimeout(() => t.remove(), 5000);
        }
        
        checkFreeboxStatus();
        setInterval(checkFreeboxStatus, 30000);
    `;
}

