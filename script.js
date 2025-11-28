document.addEventListener('DOMContentLoaded', () => {
    // =========================================================
    // DECLARACIÓN DE VARIABLES
    // =========================================================
    const textoGuion = document.getElementById('texto-guion');
    const archivoGuion = document.getElementById('archivo-guion');
    const idiomaSelector = document.getElementById('idioma-analisis');
    const analizarBtn = document.getElementById('analizar-btn');
    const resultadosSection = document.getElementById('resultados');
    const listaPalabras = document.getElementById('lista-palabras');
    const listaPersonajes = document.getElementById('lista-personajes');

    // ELEMENTOS DE ANÁLISIS EMOCIONAL
    const generarAnalisisEmocionalBtn = document.getElementById('generar-analisis-emocional-btn');
    const resultadoEmocional = document.getElementById('resultado-emocional');

    const listaOracionesClave = document.getElementById('lista-oraciones-clave');
    const listaDialogosClave = document.getElementById('lista-dialogos-clave');

    // =========================================================
    // CONFIGURACIÓN DEL ENDPOINT
    // =========================================================
    const BACKEND_ENDPOINT = "/api/analisis-ia";

    // --- LISTAS DE STOPWORDS (Palabras a ignorar) ---
    const stopwords_es = new Set(['el', 'la', 'los', 'y', 'de', 'a', 'en', 'por', 'con', 'que', 'se', 'es', 'un', 'una', 'sus', 'mi', 'tu', 'v.o.', 'vo', 'o.s.', 'os', 'cont.', 's', 't', 'd', 'm', 'll', 've', 're', 'cut to', 'fade out', 'hombre', 'mujer', 'chico', 'chica', 'si', 'no', 'le', 'lo', 'su', 'es', 'son', 'al', 'del', 'para', 'como', 'cuando']);
    const stopwords_en = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'of', 'to', 'in', 'on', 'at', 'with', 'i', 'me', 'my', 'you', 'your', 'he', 'him', 'his', 'she', 'her', 'hers', 'it', 'v.o.', 'vo', 'o.s.', 'os', 'cont\'d', 's', 't', 'm', 'll', 've', 're', 'd', 'contd', 'its', 'thats', 'cut to', 'fade to', 'man', 'woman', 'guy', 'girl', 'boy', 'kid', 'doctor', 'mr', 'mrs', 'ms', 'if', 'not', 'we', 'us', 'they', 'them', 'is', 'are', 'was', 'were', 'for', 'as', 'when']);

    function getStopwords(idioma) {
        return idioma === 'en' ? stopwords_en : stopwords_es;
    }

    // --- FUNCIÓN DE LIMPIEZA DE FORMATO ---
    function limpiarTextoGuion(texto) {
        let textoLimpio = texto;
        textoLimpio = textoLimpio.replace(/[\0\uFEFF\u200B-\u200D\u2060\u202F\u3000]/g, '');
        textoLimpio = textoLimpio.replace(/\r\n|\r/g, '\n');
        textoLimpio = textoLimpio.replace(/\t/g, '    ');
        textoLimpio = textoLimpio.replace(/[ ]{2,}/g, ' ');
        textoLimpio = textoLimpio.replace(/(\n[ \t]*){3,}/g, '\n\n');
        textoLimpio = textoLimpio.trim();

        textoLimpio = textoLimpio.replace(/([A-Z.]{3,})([^A-Z.\n])/g, (match, p1, p2) => {
            if (p1.length > 5 && !p1.endsWith('.')) {
                return p1 + '\n' + p2;
            }
            return match;
        });
        return textoLimpio;
    }

    // =========================================================
    // LÓGICA DE GENERACIÓN DE ANÁLISIS EMOCIONAL
    // =========================================================
    async function generarAnalisisEmocional(guion, analisisCuantitativo) {
        resultadoEmocional.innerHTML = '<p>Analizando la intensidad emocional con Groq... ⏳</p>';

        try {
            const response = await fetch(BACKEND_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    guion: guion,
                    analisisCuantitativo: analisisCuantitativo
                })
            });

            const data = await response.json();

            if (response.ok) {
                return data.analysis;
            } else {
                console.error("Error del backend:", data.error);
                return `<p class="error-ia">🚨 Error del servidor: ${data.error || 'Fallo desconocido.'}</p>`;
            }

        } catch (error) {
            console.error("Error de red o conexión:", error);
            return `<p class="error-ia">🔌 Error de conexión: No se pudo conectar a ${BACKEND_ENDPOINT}. Verifica que tu proyecto esté desplegado en Vercel.</p>`;
        }
    }

    generarAnalisisEmocionalBtn.addEventListener('click', async () => {
        const guion = textoGuion.value.trim();
        if (guion.length < 50) {
            resultadoEmocional.innerHTML = '<p>El guion es demasiado corto.</p>';
            return;
        }

        const idiomaSeleccionado = idiomaSelector.value;
        const analisisCuantitativo = analizarTextoGuion(guion, idiomaSeleccionado);

        mostrarResultados(analisisCuantitativo);
        resultadosSection.style.display = 'block';

        const analisisHTML = await generarAnalisisEmocional(guion, analisisCuantitativo);
        resultadoEmocional.innerHTML = `<div class="feedback-box">${analisisHTML}</div>`;
        resultadoEmocional.scrollIntoView({ behavior: 'smooth' });
    });

    // =========================================================
    // LÓGICA DE ANÁLISIS CUANTITATIVO (MEJORADA)
    // =========================================================

    textoGuion.addEventListener('input', () => {
        const textoActual = textoGuion.value;
        const textoLimpio = limpiarTextoGuion(textoActual);
        if (textoActual !== textoLimpio) {
            textoGuion.value = textoLimpio;
        }
    });

    archivoGuion.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) { return; }
        const fileName = file.name.toLowerCase();

        if (fileName.endsWith('.txt')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                textoGuion.value = limpiarTextoGuion(e.target.result);
                alert(`Archivo "${file.name}" cargado.`);
                archivoGuion.value = '';
            };
            reader.readAsText(file, 'UTF-8');
        }
        else if (fileName.endsWith('.docx')) {
            if (typeof mammoth === 'undefined') {
                alert('Librería Mammoth no disponible.'); return;
            }
            const reader = new FileReader();
            reader.onload = (e) => {
                mammoth.extractRawText({ arrayBuffer: e.target.result })
                    .then(result => {
                        textoGuion.value = limpiarTextoGuion(result.value);
                        alert(`Archivo "${file.name}" cargado.`);
                    })
                    .catch(err => alert(`Error DOCX: ${err.message}`));
            };
            reader.readAsArrayBuffer(file);
        }
        archivoGuion.value = '';
    });

    analizarBtn.addEventListener('click', (e) => {
        e.preventDefault();
        let guion = textoGuion.value.trim();
        const idiomaSeleccionado = idiomaSelector.value;

        if (guion.length === 0) {
            alert('Por favor, pega un guion.');
            return;
        }
        guion = limpiarTextoGuion(guion);
        textoGuion.value = guion;
        const analisis = analizarTextoGuion(guion, idiomaSeleccionado);
        mostrarResultados(analisis);
        resultadosSection.style.display = 'block';
        resultadosSection.scrollIntoView({ behavior: 'smooth' });
    });

    // --- FUNCIÓN PRINCIPAL DE ANÁLISIS MEJORADA ---
    function analizarTextoGuion(texto, idioma) {
        const stopwords = getStopwords(idioma);
        const lineas = texto.split('\n');
        const dialogosPorPersonaje = {};
        let textoTotalDialogos = '';
        const frecuenciaPersonajes = {};
        let personajeActual = null;

        // LISTA NEGRA: Palabras técnicas que NO son personajes
        const blacklist = new Set([
            'EXT.', 'INT.', 'EXT', 'INT', 'I/E', 'DÍA', 'NOCHE', 'DAY', 'NIGHT',
            'FADE IN', 'FADE OUT', 'CUT TO', 'CORTE A', 'DISOLVENCIA', 'TRANSICIÓN',
            'AMANECER', 'ATARDECER', 'CONTINÚA', 'CONT', 'CONT\'D', 'V.O.', 'O.S.',
            'ESCENA', 'TITULO', 'LOGLINE', 'SINOPSIS', 'AUTOR', 'BORRADOR',
            'MOMENTO', 'ENTRAMOS', 'FUNDIDO', 'PERSONAJES', 'NOTA', 'FIN'
        ]);

        lineas.forEach((linea, index) => {
            const lineaTrim = linea.trim();
            if (!lineaTrim) return;

            // 1. Detección de Personaje
            const posibleNombre = lineaTrim.split('(')[0].trim().replace(/\^/g, ""); // Limpiar
            const esMayuscula = (posibleNombre === posibleNombre.toUpperCase()) && /[A-Z]/.test(posibleNombre);

            // CORRECCIÓN CLAVE: Usamos 'some' para ver si empieza con alguna palabra prohibida
            const esTecnico = [...blacklist].some(termino => posibleNombre.startsWith(termino)) ||
                lineaTrim.startsWith('INT.') ||
                lineaTrim.startsWith('EXT.');

            if (esMayuscula && !esTecnico && posibleNombre.length > 1 && posibleNombre.length < 30) {
                // Heurística: ¿La siguiente línea parece diálogo?
                let esCabeceraDeDialogo = false;
                if (index + 1 < lineas.length) {
                    const siguienteLinea = lineas[index + 1].trim();
                    if (siguienteLinea && (siguienteLinea !== siguienteLinea.toUpperCase() || siguienteLinea.startsWith('('))) {
                        esCabeceraDeDialogo = true;
                    }
                }

                if (esCabeceraDeDialogo) {
                    personajeActual = posibleNombre;
                    frecuenciaPersonajes[personajeActual] = (frecuenciaPersonajes[personajeActual] || 0) + 1;
                    if (!dialogosPorPersonaje[personajeActual]) {
                        dialogosPorPersonaje[personajeActual] = [];
                    }
                    return;
                }
            }

            // 2. Detección de Diálogo
            if (personajeActual && !esTecnico && !esMayuscula) {
                let dialogoLimpio = lineaTrim.replace(/\([^)]*\)/g, '').trim();
                if (dialogoLimpio.length > 0) {
                    const numDialogos = dialogosPorPersonaje[personajeActual].length;
                    if (numDialogos > 0 && dialogosPorPersonaje[personajeActual][numDialogos - 1].end === index - 1) {
                        dialogosPorPersonaje[personajeActual][numDialogos - 1].texto += ' ' + dialogoLimpio;
                        dialogosPorPersonaje[personajeActual][numDialogos - 1].end = index;
                    } else {
                        dialogosPorPersonaje[personajeActual].push({ texto: dialogoLimpio, start: index, end: index });
                    }
                    textoTotalDialogos += ' ' + dialogoLimpio;
                }
            } else if (esTecnico) {
                personajeActual = null;
            }
        });

        // 3. Procesamiento de Resultados
        const topPersonajes = Object.entries(frecuenciaPersonajes)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5);

        const nombresPersonajes = new Set(Object.keys(frecuenciaPersonajes));

        const frecuenciaPalabras = {};
        let textoLimpioAnalisis = textoTotalDialogos.toLowerCase()
            .replace(/[0-9]|[\.,\/#!$%\^&\*;:{}=\-_~()¡¿?""]/g, ' ');

        const palabras = textoLimpioAnalisis.split(/\s+/)
            .filter(word => word.length > 3 && !stopwords.has(word) && !nombresPersonajes.has(word.toUpperCase()));

        palabras.forEach(palabra => {
            frecuenciaPalabras[palabra] = (frecuenciaPalabras[palabra] || 0) + 1;
        });

        const topPalabras = Object.entries(frecuenciaPalabras)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 10);

        const top5Palabras = topPalabras.map(([word]) => word);

        // Oraciones Clave
        const oraciones = textoTotalDialogos.match(/[^\.!\?]+[\.!\?]/g) || [];
        const oracionesClavePonderadas = [];
        oraciones.forEach(oracion => {
            let oracionLimpia = oracion.toLowerCase();
            const longitud = oracionLimpia.split(/\s+/).length;
            let score = 0;
            top5Palabras.forEach(w => { if(oracionLimpia.includes(w)) score++; });
            if (longitud > 5 && score >= 1) oracionesClavePonderadas.push({ oracion: oracion.trim(), score: score });
        });
        const uniqueOracionesClave = [...new Set(oracionesClavePonderadas.sort((a,b)=>b.score-a.score).map(i=>i.oracion))].slice(0, 5);

        // Diálogos Clave
        const dialogosClave = [];
        topPersonajes.slice(0, 2).forEach(([personaje]) => {
            const dialogos = dialogosPorPersonaje[personaje] || [];
            const dialogosPonderados = dialogos.map(d => {
                let score = 0;
                top5Palabras.forEach(w => { if(d.texto.toLowerCase().includes(w)) score++; });
                return { ...d, score: score + (d.texto.length / 50) };
            }).sort((a, b) => b.score - a.score).slice(0, 2);

            dialogosPonderados.forEach(d => {
                dialogosClave.push({ personaje, dialogo: d.texto.substring(0, 150) + '...' });
            });
        });

        return { topPalabras, topPersonajes, oracionesClave: uniqueOracionesClave, dialogosClave: dialogosClave };
    }

    function mostrarResultados(analisis) {
        listaPalabras.innerHTML = '';
        listaPersonajes.innerHTML = '';
        listaOracionesClave.innerHTML = '';
        listaDialogosClave.innerHTML = '';

        if (analisis.topPersonajes.length === 0) {
            listaPersonajes.innerHTML = '<li>No se detectaron personajes claros. Revisa el formato (NOMBRES EN MAYÚSCULAS).</li>';
        } else {
            analisis.topPersonajes.forEach(([personaje, count]) => {
                const li = document.createElement('li');
                li.innerHTML = `<strong>${personaje}</strong>: ${count} intervenciones`;
                listaPersonajes.appendChild(li);
            });
        }

        analisis.topPalabras.forEach(([palabra, count]) => {
            const li = document.createElement('li');
            li.innerHTML = `<strong>${palabra}</strong>: ${count} veces`;
            listaPalabras.appendChild(li);
        });

        analisis.oracionesClave.forEach(oracion => {
            const li = document.createElement('li');
            li.textContent = oracion;
            listaOracionesClave.appendChild(li);
        });

        analisis.dialogosClave.forEach(item => {
            const li = document.createElement('li');
            li.innerHTML = `<strong>${item.personaje}:</strong> "${item.dialogo}"`;
            listaDialogosClave.appendChild(li);
        });
    }
});