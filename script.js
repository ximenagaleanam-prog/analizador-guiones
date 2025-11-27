document.addEventListener('DOMContentLoaded', () => {
    // =========================================================
    // 1. CONFIGURACIÓN Y VARIABLES
    // =========================================================
    // Detector automático de entorno
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const BACKEND_ENDPOINT = isLocalhost ? '/api/analisis-ia' : '/api/analisis-ia';

    console.log(`🚀 Sistema iniciado en modo: ${isLocalhost ? 'LOCAL' : 'PRODUCCIÓN'}`);

    const textoGuion = document.getElementById('texto-guion');
    const archivoGuion = document.getElementById('archivo-guion');
    const idiomaSelector = document.getElementById('idioma-analisis');
    const analizarBtn = document.getElementById('analizar-btn');
    const resultadosSection = document.getElementById('resultados');
    const listaPalabras = document.getElementById('lista-palabras');
    const listaPersonajes = document.getElementById('lista-personajes');
    const listaOracionesClave = document.getElementById('lista-oraciones-clave');
    const listaDialogosClave = document.getElementById('lista-dialogos-clave');
    const generarAnalisisEmocionalBtn = document.getElementById('generar-analisis-emocional-btn');
    const resultadoEmocional = document.getElementById('resultado-emocional');

    // =========================================================
    // 2. LISTAS DE EXCLUSIÓN (STOPWORDS + JERGA CINE)
    // =========================================================
    const technicalJargon = new Set([
        'int', 'ext', 'int.', 'ext.', 'día', 'noche', 'day', 'night', 'dawn', 'dusk', 'amanecer',
        'atardecer', 'continuous', 'continuo', 'cut to', 'fade in', 'fade out', 'dissolve to',
        'v.o.', 'o.s.', 'cont', "cont'd", 'off', 'pan', 'tilt', 'zoom', 'cu', 'plano', 'cámara',
        'silencio', 'pausa', 'beat', 'fin', 'title', 'credit'
    ]);

    const stopwords_es = new Set(['el', 'la', 'los', 'las', 'un', 'una', 'y', 'de', 'a', 'en', 'por', 'con', 'que', 'se', 'es', 'sus', 'mi', 'tu', 'su', 'al', 'del', 'lo', 'le', 'me', 'te', 'nos', 'si', 'no', 'pero', 'o', 'porque', 'cuando', 'donde', 'quien', 'como', 'muy', 'más', 'ese', 'este', 'eso', 'esto', 'hombre', 'mujer']);
    const stopwords_en = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'of', 'to', 'in', 'on', 'at', 'with', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'my', 'your', 'his', 'our', 'their', 'if', 'not', 'is', 'are', 'was', 'were', 'that', 'this', 'what', 'when', 'where', 'who', 'how', 'man', 'woman']);

    function getStopwords(idioma) {
        const base = idioma === 'en' ? stopwords_en : stopwords_es;
        // Unimos las palabras comunes con la jerga técnica
        return new Set([...base, ...technicalJargon]);
    }

    // =========================================================
    // 3. LIMPIEZA Y LECTURA DE ARCHIVOS (ROBUSTA)
    // =========================================================
    function limpiarTextoGuion(texto) {
        let limpio = texto
            .replace(/[\0\uFEFF\u200B-\u200D\u2060\u202F\u3000]/g, '') // Caracteres invisibles
            .replace(/\r\n|\r/g, '\n')
            .replace(/\t/g, ' ')
            .replace(/[ ]{2,}/g, ' ') // Dobles espacios
            .trim();

        // Formateo visual simple para nombres de personajes pegados
        limpio = limpio.replace(/([A-Z.]{3,})([^A-Z.\n])/g, (match, p1, p2) => {
            return (p1.length > 3 && !p1.includes('.')) ? p1 + '\n' + p2 : match;
        });
        return limpio;
    }

    // Función Promisificada para leer archivos (Soluciona el problema del DOCX)
    function leerArchivoPromesa(file) {
        return new Promise((resolve, reject) => {
            const fileName = file.name.toLowerCase();

            if (fileName.endsWith('.txt')) {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.onerror = () => reject("Error leyendo TXT");
                reader.readAsText(file, 'UTF-8');
            }
            else if (fileName.endsWith('.docx')) {
                if (typeof mammoth === 'undefined') {
                    return reject("Librería Mammoth no encontrada. Revisa tu conexión.");
                }
                const reader = new FileReader();
                reader.onload = (e) => {
                    mammoth.extractRawText({ arrayBuffer: e.target.result })
                        .then(result => {
                            if (!result.value.trim()) reject("El DOCX parece vacío o ilegible.");
                            else resolve(result.value);
                        })
                        .catch(err => reject(`Error Mammoth: ${err.message}`));
                };
                reader.onerror = () => reject("Error leyendo binario DOCX");
                reader.readAsArrayBuffer(file);
            }
            else {
                reject("Formato no soportado (solo .txt o .docx)");
            }
        });
    }

    // Listener de carga de archivo optimizado
    archivoGuion.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        textoGuion.value = "⏳ Procesando archivo... por favor espera.";
        textoGuion.disabled = true;

        try {
            const contenido = await leerArchivoPromesa(file);
            textoGuion.value = limpiarTextoGuion(contenido);
            alert(`✅ Archivo "${file.name}" cargado correctamente.`);
        } catch (error) {
            console.error(error);
            textoGuion.value = "";
            alert(`❌ Error: ${error}`);
        } finally {
            textoGuion.disabled = false;
            archivoGuion.value = '';
        }
    });

    // =========================================================
    // 4. LÓGICA DE ANÁLISIS CUANTITATIVO (PRESERVA TU LÓGICA)
    // =========================================================
    function analizarTextoGuion(texto, idioma) {
        const stopwords = getStopwords(idioma);
        const lineas = texto.split('\n');

        const dialogosPorPersonaje = {};
        const frecuenciaPersonajes = {};
        let personajeActual = null;
        let textoTotalDialogos = '';

        // -- Fase 1: Extracción de Personajes y Diálogos --
        lineas.forEach((linea, index) => {
            const lineaTrim = linea.trim();
            // Detectar Personaje: Mayúsculas, longitud > 2, sin números excesivos, no es jerga técnica
            const posiblePersonaje = lineaTrim.toUpperCase() === lineaTrim && lineaTrim.length > 2 && !/\d/.test(lineaTrim);
            const esJerga = technicalJargon.has(lineaTrim.toLowerCase().replace(/[:.]/g, ''));

            if (posiblePersonaje && !esJerga) {
                personajeActual = lineaTrim.split('(')[0].trim(); // Quitar (V.O.)
                frecuenciaPersonajes[personajeActual] = (frecuenciaPersonajes[personajeActual] || 0) + 1;
                if (!dialogosPorPersonaje[personajeActual]) dialogosPorPersonaje[personajeActual] = [];
            }
            else if (personajeActual && lineaTrim.length > 0) {
                // Es diálogo
                let dialogoLimpio = lineaTrim.replace(/\([^)]*\)/g, '').trim(); // Quitar parentesis
                if (dialogoLimpio) {
                    dialogosPorPersonaje[personajeActual].push(dialogoLimpio);
                    textoTotalDialogos += ' ' + dialogoLimpio;
                }
            }
            else if (lineaTrim === '') {
                personajeActual = null;
            }
        });

        // -- Fase 2: Top Personajes --
        const topPersonajes = Object.entries(frecuenciaPersonajes)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5);

        // -- Fase 3: Top Palabras (Filtrado mejorado) --
        const frecuenciaPalabras = {};
        const palabras = textoTotalDialogos.toLowerCase()
            .replace(/[.,/#!$%^&*;:{}=\-_`~()¡¿?"]/g, ' ') // Quitar puntuación
            .split(/\s+/)
            .filter(w => w.length > 3 && !stopwords.has(w)); // Filtrar stopwords y jerga

        palabras.forEach(w => frecuenciaPalabras[w] = (frecuenciaPalabras[w] || 0) + 1);

        const topPalabras = Object.entries(frecuenciaPalabras)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 10);

        return { topPersonajes, topPalabras, dialogosPorPersonaje };
    }

    function mostrarResultados(analisis) {
        // Limpiar
        listaPalabras.innerHTML = '';
        listaPersonajes.innerHTML = '';

        // Renderizar Personajes
        if (analisis.topPersonajes.length === 0) {
            listaPersonajes.innerHTML = '<li>No se detectaron personajes claros. (Revisa el formato).</li>';
        } else {
            analisis.topPersonajes.forEach(([p, c]) => {
                const li = document.createElement('li');
                li.innerHTML = `<strong>${p}</strong>: ${c} intervenciones`;
                listaPersonajes.appendChild(li);
            });
        }

        // Renderizar Palabras
        if (analisis.topPalabras.length === 0) {
            listaPalabras.innerHTML = '<li>No hay suficientes datos.</li>';
        } else {
            analisis.topPalabras.forEach(([w, c]) => {
                const li = document.createElement('li');
                li.innerHTML = `<strong>${w}</strong>: ${c} veces`;
                listaPalabras.appendChild(li);
            });
        }
    }

    // =========================================================
    // 5. EVENTOS DE INTERFAZ
    // =========================================================

    // Botón Análisis Local
    analizarBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const guion = textoGuion.value.trim();
        if (!guion) return alert('Por favor, pega o sube un guion.');

        const analisis = analizarTextoGuion(guion, idiomaSelector.value);
        mostrarResultados(analisis);
        resultadosSection.style.display = 'block';
        resultadosSection.scrollIntoView({ behavior: 'smooth' });
    });

    // Botón Análisis IA (Serverless)
    generarAnalisisEmocionalBtn.addEventListener('click', async () => {
        const guion = textoGuion.value.trim();
        if (guion.length < 50) return alert('El guion es muy corto para la IA.');

        // Ejecutamos análisis local para enviar contexto a la IA
        const analisisCuantitativo = analizarTextoGuion(guion, idiomaSelector.value);

        resultadoEmocional.innerHTML = '<p>🧠 Conectando con Groq (Mixtral-32k)... Analizando emociones ⏳</p>';
        resultadoEmocional.scrollIntoView({ behavior: 'smooth' });

        try {
            const response = await fetch(BACKEND_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ guion, analisisCuantitativo })
            });

            const data = await response.json();

            if (response.ok) {
                resultadoEmocional.innerHTML = `<div class="feedback-box">${data.analysis}</div>`;
            } else {
                throw new Error(data.error || 'Error desconocido');
            }
        } catch (error) {
            resultadoEmocional.innerHTML = `<p style="color:red; font-weight:bold;">🚨 Error de conexión: ${error.message}</p>`;
        }
    });
});