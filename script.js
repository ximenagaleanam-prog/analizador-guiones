document.addEventListener('DOMContentLoaded', () => {
    // REFERENCIAS DOM
    const archivoInput = document.getElementById('archivo-guion');
    const textoGuion = document.getElementById('texto-guion');
    const analizarBtn = document.getElementById('analizar-btn');
    const resultadosSection = document.getElementById('resultados');
    const idiomaSelector = document.getElementById('idioma-analisis');
    const listaPersonajes = document.getElementById('lista-personajes');
    const listaPalabras = document.getElementById('lista-palabras');
    const listaEmociones = document.getElementById('lista-emociones');

    // DICCIONARIO BÁSICO DE EMOCIONES (Español)
    // Esto nos permite detectar el tono sin usar IA costosa
    const diccionarioEmociones = {
        'amor': '❤️', 'querer': '❤️', 'amar': '❤️', 'beso': '❤️', 'pasión': '❤️',
        'muerte': '💀', 'matar': '💀', 'sangre': '💀', 'arma': '💀', 'dolor': '💀',
        'miedo': '😨', 'temor': '😨', 'gritar': '😨', 'correr': '😨', 'oscuro': '😨',
        'feliz': '😊', 'risa': '😊', 'sonreír': '😊', 'alegría': '😊',
        'triste': '😢', 'llorar': '😢', 'lágrima': '😢', 'soledad': '😢',
        'duda': '🤔', 'quizás': '🤔', 'pensar': '🤔', 'verdad': '🤔'
    };

    // 1. MANEJO DE ARCHIVOS (TXT, DOCX, PDF)
    archivoInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        textoGuion.value = "⏳ Leyendo archivo... esto puede tardar unos segundos.";

        try {
            let textoExtraido = "";

            if (file.type === 'application/pdf') {
                // Lógica PDF.js
                const arrayBuffer = await file.arrayBuffer();
                const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();
                    const pageText = textContent.items.map(item => item.str).join(" ");
                    textoExtraido += pageText + "\n";
                }
            } else if (file.name.endsWith('.docx')) {
                // Lógica Mammoth
                const arrayBuffer = await file.arrayBuffer();
                const result = await mammoth.extractRawText({ arrayBuffer });
                textoExtraido = result.value;
            } else {
                // Lógica Texto Plano
                textoExtraido = await file.text();
            }

            textoGuion.value = textoExtraido;
            console.log("✅ Archivo cargado con éxito.");

        } catch (error) {
            console.error(error);
            textoGuion.value = "❌ Error al leer el archivo. Asegúrate de que no esté dañado.";
            alert("Error: " + error.message);
        }
    });

    // 2. BOTÓN DE ANÁLISIS
    analizarBtn.addEventListener('click', () => {
        const guion = textoGuion.value.trim();
        if (guion.length < 50) return alert("El texto es muy corto o está vacío.");

        const resultados = procesarGuion(guion);
        renderizarResultados(resultados);
    });

    // =========================================================
    // 3. LÓGICA DE PROCESAMIENTO PULIDA (El "Motor")
    // =========================================================
    function procesarGuion(texto) {
        const lineas = texto.split(/\r?\n/);
        const contPersonajes = {};
        const contPalabras = {};
        const contEmociones = {};

        // 1. DICCIONARIO DE EMOCIONES (Español + Inglés)
        const diccionarioEmociones = {
            // AMOR / POSITIVO
            'amor': '❤️', 'love': '❤️', 'querer': '❤️', 'amar': '❤️', 'beso': '❤️', 'kiss': '❤️',
            'feliz': '😊', 'happy': '😊', 'smile': '😊', 'sonrisa': '😊', 'risa': '😊', 'laugh': '😊',
            'hope': '🌟', 'esperanza': '🌟', 'friend': '🤝', 'amigo': '🤝',

            // MIEDO / TENSIÓN
            'miedo': '😨', 'fear': '😨', 'scream': '😨', 'grito': '😨', 'run': '😨', 'correr': '😨',
            'dark': '🌑', 'oscuro': '🌑', 'shadow': '🌑', 'sombra': '🌑', 'danger': '⚠️', 'peligro': '⚠️',

            // TRISTEZA / DOLOR
            'triste': '😢', 'sad': '😢', 'llorar': '😢', 'cry': '😢', 'tears': '😢', 'lágrimas': '😢',
            'pain': '💔', 'dolor': '💔', 'hurt': '💔', 'herido': '💔', 'alone': '🥀', 'solo': '🥀',

            // IRA / VIOLENCIA
            'muerte': '💀', 'death': '💀', 'kill': '💀', 'matar': '💀', 'gun': '🔫', 'arma': '🔫',
            'blood': '🩸', 'sangre': '🩸', 'fight': '👊', 'pelea': '👊', 'golpe': '👊', 'hit': '👊',
            'angry': '😡', 'enojado': '😡', 'hate': '😡', 'odio': '😡'
        };

        // 2. LISTA MAESTRA DE PALABRAS IGNORADAS (Stopwords + Guionismo)
        // Incluye conectores (ES/EN) y verbos de acción comunes en guiones que no son temas.
        const stopwords = new Set([
            // ESPAÑOL
            'el', 'la', 'los', 'las', 'un', 'una', 'de', 'del', 'a', 'al', 'en', 'y', 'e', 'o', 'u',
            'que', 'su', 'sus', 'por', 'para', 'con', 'se', 'lo', 'les', 'me', 'te', 'le', 'mi', 'tu',
            'es', 'son', 'fue', 'era', 'está', 'están', 'hay', 'muy', 'más', 'pero', 'sin', 'sobre',
            'este', 'esta', 'ese', 'eso', 'cuando', 'donde', 'como', 'porque', 'entonces', 'luego',
            'si', 'no', 'ni', 'ya', 'ha', 'he', 'había', 'qué', 'sí', 'tú', 'él', 'ella', 'nos',
            'yo', 'ellos', 'ellas', 'nosotros', 'usted', 'ustedes', 'mío', 'tuyo', 'suyo',

            // INGLÉS (English) - CRUCIAL PARA TOY STORY
            'the', 'a', 'an', 'and', 'or', 'but', 'if', 'of', 'at', 'by', 'for', 'with', 'about',
            'against', 'between', 'into', 'through', 'during', 'before', 'after', 'above', 'below',
            'to', 'from', 'up', 'down', 'in', 'out', 'on', 'off', 'over', 'under', 'again', 'further',
            'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'any', 'both',
            'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only',
            'own', 'same', 'so', 'than', 'too', 'very', 'can', 'will', 'just', 'don', 'should', 'now',
            'he', 'she', 'it', 'they', 'we', 'you', 'i', 'him', 'her', 'them', 'us', 'his', 'hers',
            'their', 'theirs', 'myself', 'yourself', 'yours', 'mine', 'is', 'are', 'was', 'were',
            'have', 'has', 'had', 'do', 'does', 'did', 'be', 'been', 'being', 'get', 'got',
            'going', 'gonna', 'wanna', 'yeah', 'hey', 'okay', 'right', 'well', 'oh',

            // TÉRMINOS TÉCNICOS DE GUION (Para que no salgan como temas)
            'int', 'ext', 'day', 'night', 'dawn', 'dusk', 'cut', 'fade', 'dissolve', 'continuous',
            'voice', 'over', 'os', 'pov', 'cu', 'ecu', 'ls', 'ms', 'cont', 'continued',
            'looks', 'turns', 'walks', 'runs', 'sees', 'back', 'room', 'door', 'hand', 'head', 'eyes'
        ]);

        const blacklistEncabezados = ['INT.', 'EXT.', 'INT', 'EXT', 'DÍA', 'NOCHE', 'DAY', 'NIGHT', 'CORTE', 'FADE', 'FIN'];

        // --- PRIMER PASADA: PROCESAR LÍNEAS ---
        lineas.forEach((linea, index) => {
            const lineaLimpia = linea.trim();
            if (!lineaLimpia) return;

            // A. DETECCIÓN DE PERSONAJES
            // Limpieza: "WOODY (O.S.)" -> "WOODY"
            let posibleNombre = lineaLimpia.replace(/\s*\(.*?\)\s*/g, '').replace(/[^a-zA-ZáéíóúñÁÉÍÓÚÑ ]/g, "").trim();

            const esMayuscula = (posibleNombre === posibleNombre.toUpperCase()) && /[A-Z]/.test(posibleNombre);
            const esTecnico = blacklistEncabezados.some(t => lineaLimpia.startsWith(t));
            const longitudOk = posibleNombre.length > 2 && posibleNombre.length < 30;

            if (esMayuscula && !esTecnico && longitudOk) {
                // Validación de contexto (mira la línea siguiente)
                let j = index + 1;
                while (j < lineas.length && !lineas[j].trim()) j++; // saltar vacíos

                if (j < lineas.length) {
                    const sigLinea = lineas[j].trim();
                    // Si lo que sigue NO es mayúscula (es diálogo), entonces esto era un personaje
                    if (sigLinea && sigLinea !== sigLinea.toUpperCase()) {
                        contPersonajes[posibleNombre] = (contPersonajes[posibleNombre] || 0) + 1;
                    }
                }
            }

            // B. DETECCIÓN DE PALABRAS (TEMAS Y EMOCIONES)
            if (!esMayuscula && !esTecnico) {
                const palabras = lineaLimpia.toLowerCase()
                    .replace(/[.,¡!¿?;:"()\-]/g, '') // Quitar puntuación
                    .replace(/'s/g, '') // Quitar posesivos en inglés (Woody's -> Woody)
                    .split(/\s+/);

                palabras.forEach(p => {
                    if (p.length > 2 && !stopwords.has(p) && isNaN(p)) {
                        // Conteo Temático
                        contPalabras[p] = (contPalabras[p] || 0) + 1;

                        // Conteo Emocional (Búsqueda parcial inteligente)
                        for (const [raiz, icono] of Object.entries(diccionarioEmociones)) {
                            // Si la palabra contiene la raíz emocional (ej: "loving" tiene "love")
                            if (p.includes(raiz)) {
                                const key = `${raiz} ${icono}`;
                                contEmociones[key] = (contEmociones[key] || 0) + 1;
                                break; // Solo contar una emoción por palabra
                            }
                        }
                    }
                });
            }
        });

        // --- SEGUNDA PASADA: LIMPIEZA FINAL ---

        // 1. Obtener nombres de personajes detectados (en minúsculas para comparar)
        const nombresPersonajes = Object.keys(contPersonajes).map(n => n.toLowerCase());

        // 2. Filtrar Palabras Clave: Eliminar si es un nombre de personaje o un número
        const palabrasFiltradas = Object.entries(contPalabras).filter(([palabra, cantidad]) => {
            // Si la palabra es igual a un personaje detectado (ej: "woody" == "woody"), la borramos de Temas
            if (nombresPersonajes.includes(palabra)) return false;
            return true;
        });

        // Ordenar Resultados
        const topPersonajes = Object.entries(contPersonajes).sort((a,b) => b[1]-a[1]).slice(0, 10);
        const topPalabras = palabrasFiltradas.sort((a,b) => b[1]-a[1]).slice(0, 10);
        const topEmociones = Object.entries(contEmociones).sort((a,b) => b[1]-a[1]).slice(0, 8);

        return { topPersonajes, topPalabras, topEmociones };
    }

    // 4. RENDERIZADO EN HTML
    function renderizarResultados(datos) {
        resultadosSection.style.display = 'block';

        // Limpiar listas
        listaPersonajes.innerHTML = '';
        listaPalabras.innerHTML = '';
        listaEmociones.innerHTML = '';

        // Personajes
        if (datos.topPersonajes.length === 0) listaPersonajes.innerHTML = '<li>⚠️ No se detectaron personajes claros.</li>';
        datos.topPersonajes.forEach(([nombre, num]) => {
            const li = document.createElement('li');
            li.innerHTML = `<strong>${nombre}</strong> <small>(${num} intervenciones)</small>`;
            listaPersonajes.appendChild(li);
        });

        // Palabras Clave
        datos.topPalabras.forEach(([palabra, num]) => {
            const li = document.createElement('li');
            li.innerText = `${palabra} (${num})`;
            listaPalabras.appendChild(li);
        });

        // Emociones
        if (datos.topEmociones.length === 0) listaEmociones.innerHTML = '<li>Neutral / No detectado</li>';
        datos.topEmociones.forEach(([emo, num]) => {
            const li = document.createElement('li');
            li.style.color = '#d32f2f';
            li.innerText = `${emo} (${num})`;
            listaEmociones.appendChild(li);
        });

        resultadosSection.scrollIntoView({ behavior: 'smooth' });
    }
});