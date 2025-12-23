// --- КОНФИГУРАЦИЯ FIREBASE ---
// 1. Зайди на https://console.firebase.google.com/
// 2. Создай проект (Add Project), назови как хочешь.
// 3. Создай Web App (значок </>), скопируй конфиг ниже.
// 4. В Database выбери Realtime Database -> Create Database -> Start in Test Mode.

const firebaseConfig = {
  apiKey: "AIzaSyCW04d4cAcx6xJCpWWU3ON0EBDlj-xhUCY",
  authDomain: "discordvote2025.firebaseapp.com",
  projectId: "discordvote2025",
  storageBucket: "discordvote2025.firebasestorage.app",
  messagingSenderId: "1000628611204",
  appId: "1:1000628611204:web:ef0d13bf755dac95cdfad1"
};

// Инициализация
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();

// --- ЛОГИКА ---

// Проверка: голосовал ли уже (localStorage)
const STORAGE_KEY = 'discord_vote_2024_status';
const USER_ID_KEY = 'discord_vote_uid';

function getUid() {
    let uid = localStorage.getItem(USER_ID_KEY);
    if (!uid) {
        uid = 'user_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem(USER_ID_KEY, uid);
    }
    return uid;
}

// 1. Логика Главной страницы (Счетчик)
if (window.location.pathname.endsWith('index.html') || window.location.pathname.endsWith('/')) {
    const counterEl = document.getElementById('live-total-counter');
    if (counterEl) {
        db.ref('stats/totalVotes').on('value', (snapshot) => {
            const count = snapshot.val() || 0;
            counterEl.innerText = count;
            // Анимация
            counterEl.style.transform = "scale(1.2)";
            setTimeout(() => counterEl.style.transform = "scale(1)", 200);
        });
    }
}

// 2. Логика Страницы Голосования
const voteForm = document.getElementById('voting-form');
if (voteForm) {
    // Проверка на повторное голосование
    if (localStorage.getItem(STORAGE_KEY) === 'voted') {
        document.getElementById('already-voted-msg').style.display = 'flex';
        voteForm.style.opacity = '0.5';
        voteForm.style.pointerEvents = 'none';
        setTimeout(() => window.location.href = 'results.html', 3000);
    }

    voteForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const formData = new FormData(voteForm);
        const data = {};
        let isComplete = true;

        // Собираем данные по 14 категориям
        for (let i = 1; i <= 14; i++) {
            const val = formData.get(`cat${i}`);
            if (!val) {
                alert(`Вы забыли проголосовать в категории ${i}!`);
                isComplete = false;
                break;
            }
            data[`cat${i}`] = val;
        }

        if (isComplete) {
            const uid = getUid();
            
            // Атомарное обновление базы
            const updates = {};
            
            // 1. Записываем сам голос юзера (чтобы знать КТО и КАК голосовал)
            updates[`votes/${uid}`] = {
                timestamp: firebase.database.ServerValue.TIMESTAMP,
                choices: data
            };
            
            // 2. Инкрементируем счетчики для каждого кандидата
            for (let [cat, candidate] of Object.entries(data)) {
                // Используем transaction для безопасного счетчика
                db.ref(`results/${cat}/${candidate}`).transaction((current) => {
                    return (current || 0) + 1;
                });
            }

            // 3. Общий счетчик
            db.ref('stats/totalVotes').transaction((current) => {
                return (current || 0) + 1;
            });

            // Отправляем
            db.ref().update(updates).then(() => {
                localStorage.setItem(STORAGE_KEY, 'voted');
                alert("✅ Ваш голос принят! Спасибо.");
                window.location.href = 'results.html';
            }).catch(err => {
                alert("Ошибка: " + err.message);
            });
        }
    });
}

// 3. Логика Страницы Результатов
function initResultsPage() {
    const container = document.getElementById('results-container');
    const totalEl = document.getElementById('total-voters-res');
    
    if (!container) return;

    // Названия категорий для заголовков
    const catTitles = {
        cat1: "ЛУЧШИЙ DOTA 2 ИГРОК",
        cat2: "ЛУЧШИЙ CS 2 ИГРОК",
        cat3: "ЛУЧШИЙ МУЛЬТИГЕЙМ ИГРОК",
        cat4: "ЛУЧШИЙ ЗАВОЗ ГОДА",
        cat5: "ЛУЧШИЙ РЕЙДЖ ГОДА",
        cat6: "ЛУЧШИЙ ПРОРЫВ ГОДА",
        cat7: "ЛУЧШИЙ АКТИВ ГОДА",
        cat8: "ЛУЧШИЙ МОМЕНТ ГОДА",
        cat9: "ЛУЧШИЙ ЮМОР ГОДА",
        cat10: "ЛУЧШИЙ МЕМ ГОДА",
        cat11: "ОБИЖЕНКА ГОДА",
        cat12: "САМЫЙ ДОБРЫЙ ЧЕЛ ГОДА",
        cat13: "КОРОЛЬ СЕРВЕРА",
        cat14: "КОРОЛЕВА СЕРВЕРА"
    };

    // Слушаем общий счетчик
    db.ref('stats/totalVotes').on('value', snap => {
        totalEl.innerText = snap.val() || 0;
    });

    // Слушаем результаты
    db.ref('results').on('value', (snapshot) => {
        const data = snapshot.val();
        container.innerHTML = ''; // Очистка

        if (!data) {
            container.innerHTML = '<p style="text-align:center">Голосов пока нет. Будь первым!</p>';
            return;
        }

        // Проходим по всем 14 категориям (чтобы сохранить порядок)
        for (let i = 1; i <= 14; i++) {
            const catKey = `cat${i}`;
            const catData = data[catKey] || {};
            const title = catTitles[catKey];

            // Сортировка кандидатов по убыванию голосов
            const sortedCandidates = Object.entries(catData)
                .sort(([,a], [,b]) => b - a);

            // Считаем всего голосов в этой категории (для процента)
            const totalInCat = Object.values(catData).reduce((a,b)=>a+b, 0) || 1;

            let html = `
                <div class="nomination-vote" style="padding: 20px;">
                    <h3 style="color:#7289DA; margin-bottom:15px;">${i}. ${title}</h3>
                    <div class="results-grid">
            `;

            sortedCandidates.forEach(([name, votes]) => {
                const percent = Math.round((votes / totalInCat) * 100);
                html += `
                    <div class="result-item">
                        <div class="result-header">
                            <span class="result-name">${name}</span>
                            <span class="result-percentage">${votes} г. (${percent}%)</span>
                        </div>
                        <div class="result-bar-bg">
                            <div class="result-bar-fill" style="width: ${percent}%"></div>
                        </div>
                    </div>
                `;
            });

            html += `</div></div>`;
            container.innerHTML += html;
        }
    });
}