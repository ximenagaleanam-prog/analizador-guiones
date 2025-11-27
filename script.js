document.addEventListener('DOMContentLoaded', () => {
    // =========================================================
    // 1. CONFIGURACIÓN
    // =========================================================
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    // Ajuste dinámico de la URL para evitar errores 404
    const BACKEND_ENDPOINT = '/api/analisis-ia';

    console.log(`🚀 Sistema iniciado. Endpoint: ${BACKEND_ENDPOINT}`);

    // Referencias DOM
    const textoGuion = document.getElementById('texto-guion');
    const archivoGuion = document.getElementById('archivo-guion');
    const idiomaSelector = document.getElementById('idioma-analisis');
    const analizarBtn = document.getElementById('analizar-btn');
    const resultadosSection = document.getElementById('resultados');
    const listaPalabras = document.getElementById('lista-palabras');
    const listaPersonajes = document.getElementById('lista-personajes');
    const generarAnalisisEmocionalBtn = document.getElementById('generar-analisis-emocional-btn');
    const resultadoEmocional = document.getElementById('resultado-emocional');

    // =========================================================
    // 2. FILTROS INTELIGENTES (La clave para limpiar basura)
    // =========================================================
    // Palabras comunes a ignorar en el conteo de temas
    const stopwords_es = new Set(['el', 'la', 'los', 'las', 'un', 'una', 'y', 'de', 'a', 'en', 'por', 'con', 'que', 'se', 'es', 'sus', 'mi', 'tu', 'su', 'al', 'del', 'lo', 'le', 'me', 'te', 'nos', 'si', 'no', 'pero', 'o', 'porque', 'cuando', 'donde', 'quien', 'como', 'muy', 'más', 'ese', 'este', 'eso', 'esto', 'para', 'sin', 'sobre', 'era', 'fue', 'hay', 'vez', 'todo', 'nada']);
    const stopwords_en = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'of', 'to', 'in', 'on', 'at', 'with', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'my', 'your', 'his', 'our', 'their', 'if', 'not', 'is', 'are', 'was', 'were', 'that', 'this', 'what', 'when', 'where', 'who', 'how']);

    function getStopwords(idioma) {
        return idioma === 'en' ? stopwords_en : stopwords_es;
    }

    // =========================================================
    // 3. CARGA DE ARCHIVOS ROBUSTA
    // =========================================================
    function limpiarTextoGuion(texto) {
        return texto
            .replace(/[\0\uFEFF\u200B-\u200D\u2060\u202F\u3000]/g, '')
            .replace(/\r\n|\r/g, '\n')
            .replace(/\t/g, ' ')
            .replace(/[ ]{2,}/g, ' ')
            .trim();
    }

    // Función que lee TXT o DOCX
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
                    return reject("Mammoth.js no cargó. Revisa tu internet.");
                }
                const reader = new FileReader();
                reader.onload = (e) => {
                    mammoth.extractRawText({ arrayBuffer: e.target.result })
                        .then(result => resolve(result.value))
                        .catch(err => reject(`Error DOCX: ${err.message}`));
                };
                reader.onerror = () => reject("Error leyendo binario DOCX");
                reader.readAsArrayBuffer(file);
            }
            else {
                reject("Formato no soportado. Usa .txt o .docx");
            }
        });
    }

    archivoGuion.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        textoGuion.value = "⏳ Leyendo archivo...";
        textoGuion.disabled = true;

        try {
            const contenido = await leerArchivoPromesa(file);
            textoGuion.value = limpiarTextoGuion(contenido);
            // alert(`✅ Archivo cargado.`); // Opcional: quitar alerta para fluidez
        } catch (error) {
            alert(`❌ Error: ${error}`);
            textoGuion.value = "";
        } finally {
            textoGuion.disabled = false;
            archivoGuion.value = '';
        }
    });

    // =========================================================
    // 4. ALGORITMO DE ANÁLISIS MEJORADO
    // =========================================================
    function analizarTextoGuion(texto, idioma) {
        const stopwords = getStopwords(idioma);
        const lineas = texto.split('\n');

        const frecuenciaPersonajes = {};
        const frecuenciaPalabras = {};
        let textoTotalDialogos = '';

        lineas.forEach((linea) => {
            const lineaTrim = linea.trim();
            if (lineaTrim.length < 2) return; // Ignorar líneas muy cortas

            // CRITERIOS ESTRICTOS PARA DETECTAR PERSONAJES
            const esMayusculas = lineaTrim === lineaTrim.toUpperCase();
            // Evitar encabezados de escena (INT. EXT. o que tengan guion de tiempo " - ")
            const esEncabezado = /^(INT\.|EXT\.|I\/E|INT |EXT )/i.test(lineaTrim) || lineaTrim.includes(' - ');
            const tieneNumeros = /\d/.test(lineaTrim); // Los personajes no suelen tener números (excepto R2-D2, pero es un trade-off)
            const esTransicion = /^(CUT TO|FADE|DISSOLVE)/i.test(lineaTrim);
            const esAcotacion = lineaTrim.startsWith('(') || lineaTrim.endsWith(')');

            if (esMayusculas && !esEncabezado && !tieneNumeros && !esTransicion && !esAcotacion) {
                // Limpieza final del nombre (quitar (V.O.), (CONT'D), espacios extra)
                let nombreLimpio = lineaTrim
                    .replace(/\(.*\)/g, '')  // Quitar paréntesis y contenido
                    .replace(/[^A-ZÑÁÉÍÓÚÜ ]/g, '') // Quitar símbolos raros
                    .trim();

                if (nombreLimpio.length > 2 && !stopwords.has(nombreLimpio.toLowerCase())) {
                    frecuenciaPersonajes[nombreLimpio] = (frecuenciaPersonajes[nombreLimpio] || 0) + 1;
                }
            }
            else if (!esMayusculas && !esEncabezado) {
                // Asumimos que es diálogo o acción, lo sumamos al saco de palabras
                textoTotalDialogos += ' ' + lineaTrim;
            }
        });

        // -- Procesar Top Personajes --
        const topPersonajes = Object.entries(frecuenciaPersonajes)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5);

        // -- Procesar Palabras Clave --
        const palabras = textoTotalDialogos.toLowerCase()
            .replace(/[.,/#!$%^&*;:{}=\-_`~()¡¿?"\d]/g, ' ') // Quitar puntuación y números
            .split(/\s+/)
            .filter(w => w.length > 3 && !stopwords.has(w)); // Filtrar stopwords

        palabras.forEach(w => frecuenciaPalabras[w] = (frecuenciaPalabras[w] || 0) + 1);

        const topPalabras = Object.entries(frecuenciaPalabras)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 10);

        return { topPersonajes, topPalabras };
    }

    function mostrarResultados(analisis) {
        listaPalabras.innerHTML = '';
        listaPersonajes.innerHTML = '';

        if (analisis.topPersonajes.length === 0) {
            listaPersonajes.innerHTML = '<li>⚠️ No se detectaron personajes claros. Revisa el formato.</li>';
        } else {
            analisis.topPersonajes.forEach(([p, c]) => {
                const li = document.createElement('li');
                li.innerHTML = `<strong>${p}</strong>: ${c} intervenciones`;
                listaPersonajes.appendChild(li);
            });
        }

        if (analisis.topPalabras.length === 0) {
            listaPalabras.innerHTML = '<li>Sin datos suficientes.</li>';
        } else {
            analisis.topPalabras.forEach(([w, c]) => {
                const li = document.createElement('li');
                li.innerHTML = `<strong>${w}</strong>: ${c} veces`;
                listaPalabras.appendChild(li);
            });
        }
    }

    // =========================================================
    // 5. EVENTOS
    // =========================================================

    analizarBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const guion = textoGuion.value.trim();
        if (!guion) return alert('Pega un guion primero.');

        const analisis = analizarTextoGuion(guion, idiomaSelector.value);
        mostrarResultados(analisis);
        resultadosSection.style.display = 'block';
        resultadosSection.scrollIntoView({ behavior: 'smooth' });
    });

    generarAnalisisEmocionalBtn.addEventListener('click', async () => {
        const guion = textoGuion.value.trim();
        if (guion.length < 50) return alert('El guion es muy corto.');

        const analisisCuantitativo = analizarTextoGuion(guion, idiomaSelector.value);

        resultadoEmocional.innerHTML = '<p>🧠 Conectando con IA... Analizando emociones ⏳</p>';
        resultadoEmocional.scrollIntoView({ behavior: 'smooth' });

        try {
            const response = await fetch(BACKEND_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ guion, analisisCuantitativo })
            });

            // Primero verificamos si la respuesta es JSON válido
            const contentType = response.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
                throw new Error("El servidor devolvió un error HTML (posiblemente 404 o 500). Revisa tu configuración de Vercel.");
            }

            const data = await response.json();

            if (response.ok) {
                resultadoEmocional.innerHTML = `<div class="feedback-box">${data.analysis}</div>`;
            } else {
                throw new Error(data.error || 'Error del servidor');
            }
        } catch (error) {
            console.error(error);
            resultadoEmocional.innerHTML = `<p style="color:#d9534f; font-weight:bold;">🚨 Error: ${error.message}</p>`;
        }
    });
});