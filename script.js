document.addEventListener('DOMContentLoaded', () => {
    console.log("✅ Script cargado correctamente."); // Mensaje para consola

    // =========================================================
    // 1. VARIABLES (Verificamos que existan)
    // =========================================================
    const textoGuion = document.getElementById('texto-guion');
    const analizarBtn = document.getElementById('analizar-btn');
    const resultadosSection = document.getElementById('resultados');
    const generarAnalisisEmocionalBtn = document.getElementById('generar-analisis-emocional-btn');
    const resultadoEmocional = document.getElementById('resultado-emocional');
    const idiomaSelector = document.getElementById('idioma-analisis');

    // Verificación de seguridad
    if (!analizarBtn || !textoGuion) {
        alert("🚨 ERROR CRÍTICO: No encuentro el botón o la caja de texto en el HTML. Verifica los IDs.");
        return;
    }

    // Configuración del Servidor
    const BACKEND_ENDPOINT = "/api/analisis-ia";

    // =========================================================
    // 2. BOTÓN 1: ESTADÍSTICAS RÁPIDAS (Frontend puro)
    // =========================================================
    analizarBtn.addEventListener('click', (e) => {
        e.preventDefault();
        console.log("🖱️ Botón presionado");

        let guion = textoGuion.value.trim();

        // PRUEBA DE VIDA: Si sale esta alerta, el botón funciona.
        if (guion.length === 0) {
            alert('⚠️ El campo está vacío. Por favor pega un guion.');
            return;
        }

        try {
            // Limpiar y Analizar
            guion = limpiarTextoGuion(guion);
            textoGuion.value = guion; // Actualizamos caja con texto limpio

            const analisis = analizarTextoGuion(guion, idiomaSelector.value);

            // Mostrar
            mostrarResultados(analisis);
            resultadosSection.style.display = 'block';
            resultadosSection.scrollIntoView({ behavior: 'smooth' });

        } catch (error) {
            alert("🚨 Error interno en JS: " + error.message);
            console.error(error);
        }
    });

    // =========================================================
    // 3. BOTÓN 2: ANÁLISIS IA (Backend)
    // =========================================================
    generarAnalisisEmocionalBtn.addEventListener('click', async () => {
        const guion = textoGuion.value.trim();
        if (guion.length < 50) {
            alert("El guion es muy corto para la IA.");
            return;
        }

        // Mostrar feedback visual inmediato
        resultadoEmocional.innerHTML = '<p style="color: blue;">🔄 Conectando con el cerebro de la IA... espera...</p>';

        try {
            // Re-analizamos para tener datos frescos
            const analisis = analizarTextoGuion(guion, idiomaSelector.value);

            const response = await fetch(BACKEND_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    guion: guion,
                    analisisCuantitativo: analisis
                })
            });

            const data = await response.json();

            if (response.ok) {
                resultadoEmocional.innerHTML = `<div class="feedback-box">${data.analysis}</div>`;
            } else {
                resultadoEmocional.innerHTML = `<p style="color: red;">❌ Error del servidor: ${data.error}</p>`;
            }
        } catch (error) {
            resultadoEmocional.innerHTML = `<p style="color: red;">🔌 Error de conexión: ${error.message}</p>`;
        }
    });

    // =========================================================
    // 4. FUNCIONES DE LÓGICA (Core)
    // =========================================================

    function limpiarTextoGuion(texto) {
        return texto.replace(/\r\n|\r/g, '\n').replace(/[ ]{2,}/g, ' ').trim();
    }

    function analizarTextoGuion(texto, idioma) {
        // Listas de palabras ignoradas (Stopwords)
        const stopwords = (idioma === 'en')
            ? new Set(['the', 'a', 'and', 'of', 'to', 'in', 'is', 'you', 'that', 'it', 'he', 'was', 'for', 'on', 'are', 'with', 'as', 'i', 'his', 'they', 'be', 'at', 'one', 'have', 'this', 'from', 'or', 'had', 'by', 'not', 'word', 'but', 'what', 'some', 'we', 'can', 'out', 'other', 'were', 'all', 'there', 'when', 'up', 'use', 'your', 'how', 'said', 'an', 'each', 'she'])
            : new Set(['el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'y', 'e', 'o', 'u', 'de', 'del', 'a', 'al', 'en', 'con', 'por', 'para', 'sin', 'sobre', 'entre', 'tras', 'se', 'es', 'son', 'fue', 'era', 'mi', 'tu', 'su', 'nos', 'os', 'les', 'me', 'te', 'le', 'que', 'como', 'cuando', 'donde', 'quien', 'cual', 'si', 'no', 'lo', 'los', 'estoy', 'esta', 'estamos', 'estan', 'v.o.', 'cont.']);

        const lineas = texto.split('\n');
        const frecuenciaPersonajes = {};
        const frecuenciaPalabras = {};

        // --- AQUÍ ESTÁ LA CORRECCIÓN DE "ESCENA" ---
        const blacklist = new Set(['EXT.', 'INT.', 'EXT', 'INT', 'DÍA', 'NOCHE', 'DAY', 'NIGHT', 'CUT TO', 'FADE IN', 'FADE OUT', 'ESCENA', 'TITULO', 'LOGLINE']);

        lineas.forEach((linea, index) => {
            const lineaTrim = linea.trim();
            if (!lineaTrim) return;

            // Detectar Nombre (Mayúsculas puras)
            // Lógica: Es mayúscula, tiene letras, y NO empieza con palabras técnicas
            const primeraPalabra = lineaTrim.split(' ')[0].replace(/[^A-Z]/g, ''); // Solo letras mayusculas
            const esMayuscula = (lineaTrim === lineaTrim.toUpperCase()) && /[A-Z]/.test(lineaTrim);

            // CORRECCIÓN CLAVE: Usamos .some() para ver si empieza con palabra prohibida
            const esTecnico = [...blacklist].some(term => lineaTrim.startsWith(term));

            if (esMayuscula && !esTecnico && lineaTrim.length > 2 && lineaTrim.length < 40) {
                // Verificamos si la siguiente línea parece diálogo (no vacía, no mayúscula técnica)
                if (index + 1 < lineas.length) {
                    const sig = lineas[index+1].trim();
                    if (sig && sig !== sig.toUpperCase()) {
                        const nombre = lineaTrim.split('(')[0].trim(); // Quitar acotaciones
                        frecuenciaPersonajes[nombre] = (frecuenciaPersonajes[nombre] || 0) + 1;
                    }
                }
            }

            // Conteo de palabras (simple)
            if (!esMayuscula && !esTecnico) {
                const palabras = lineaTrim.toLowerCase().replace(/[.,!?;:()]/g, '').split(/\s+/);
                palabras.forEach(p => {
                    if (p.length > 3 && !stopwords.has(p)) {
                        frecuenciaPalabras[p] = (frecuenciaPalabras[p] || 0) + 1;
                    }
                });
            }
        });

        // Ordenar Resultados
        const topPersonajes = Object.entries(frecuenciaPersonajes)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

        const topPalabras = Object.entries(frecuenciaPalabras)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8);

        return { topPersonajes, topPalabras, oracionesClave: [], dialogosClave: [] };
    }

    function mostrarResultados(analisis) {
        const listaPersonajes = document.getElementById('lista-personajes');
        const listaPalabras = document.getElementById('lista-palabras');

        listaPersonajes.innerHTML = '';
        listaPalabras.innerHTML = '';

        if (analisis.topPersonajes.length === 0) {
            listaPersonajes.innerHTML = '<li style="color:orange">No detecté personajes. Asegúrate de usar MAYÚSCULAS para los nombres.</li>';
        } else {
            analisis.topPersonajes.forEach(([p, c]) => {
                const li = document.createElement('li');
                li.innerHTML = `<strong>${p}</strong> (${c} intervenciones)`;
                listaPersonajes.appendChild(li);
            });
        }

        analisis.topPalabras.forEach(([p, c]) => {
            const li = document.createElement('li');
            li.textContent = `${p} (${c})`;
            listaPalabras.appendChild(li);
        });
    }
});