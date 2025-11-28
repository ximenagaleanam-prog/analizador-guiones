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

    // 3. LÓGICA DE PROCESAMIENTO (El "Motor")
    function procesarGuion(texto) {
        const lineas = texto.split(/\r?\n/);
        const contPersonajes = {};
        const contPalabras = {};
        const contEmociones = {};

        // Palabras a ignorar (Stopwords mejoradas)
        const stopwords = new Set([
            'el', 'la', 'los', 'las', 'un', 'una', 'de', 'del', 'a', 'al', 'en', 'y', 'e', 'o', 'u',
            'que', 'su', 'sus', 'por', 'para', 'con', 'se', 'lo', 'les', 'me', 'te', 'le', 'mi', 'tu',
            'es', 'son', 'fue', 'era', 'está', 'están', 'hay', 'muy', 'más', 'pero', 'sin', 'sobre',
            'este', 'esta', 'ese', 'eso', 'cuando', 'donde', 'como', 'porque', 'entonces', 'luego',
            'si', 'no', 'ni', 'ya', 'ha', 'he', 'había', 'qué', 'sí', 'tú', 'él', 'ella', 'nos',
            'ante', 'bajo', 'cabe', 'contra', 'desde', 'hacia', 'hasta', 'para', 'por', 'según',
            'tras', 'durante', 'mediante', 'versus', 'vía', 'todo', 'nada', 'algo', 'esto', 'eso'
        ]);

        // Palabras técnicas de guion (Blacklist)
        const blacklistGuion = ['INT.', 'EXT.', 'INT', 'EXT', 'DÍA', 'NOCHE', 'DAY', 'NIGHT', 'CORTE', 'FADE', 'FIN', 'CONTINUA'];

        lineas.forEach((linea, index) => {
            const lineaLimpia = linea.trim();
            if (!lineaLimpia) return;

            // --- A. DETECCIÓN DE PERSONAJES ---
            // 1. Quitar acotaciones entre paréntesis: "JUAN (enojado)" -> "JUAN"
            let posibleNombre = lineaLimpia.replace(/\s*\(.*?\)\s*/g, '').trim();

            // 2. Validaciones: Mayúsculas, longitud razonable, no es palabra técnica
            const esMayuscula = (posibleNombre === posibleNombre.toUpperCase()) && /[A-Z]/.test(posibleNombre);
            const esTecnico = blacklistGuion.some(t => posibleNombre.startsWith(t));
            const longitudOk = posibleNombre.length > 2 && posibleNombre.length < 40;

            if (esMayuscula && !esTecnico && longitudOk) {
                // 3. Validación de Contexto: ¿La siguiente línea parece diálogo?
                // Buscamos la siguiente línea con texto
                let j = index + 1;
                while (j < lineas.length && !lineas[j].trim()) j++;

                if (j < lineas.length) {
                    const sigLinea = lineas[j].trim();
                    // Si la siguiente línea NO es mayúscula completa, asumimos que es diálogo y validamos el personaje
                    if (sigLinea && sigLinea !== sigLinea.toUpperCase()) {
                        contPersonajes[posibleNombre] = (contPersonajes[posibleNombre] || 0) + 1;
                    }
                }
            }

            // --- B. DETECCIÓN DE PALABRAS CLAVE Y EMOCIONES ---
            if (!esMayuscula && !esTecnico) {
                // Tokenizar: minúsculas, quitar puntuación
                const palabras = lineaLimpia.toLowerCase()
                    .replace(/[.,¡!¿?;:"()\-]/g, '')
                    .split(/\s+/);

                palabras.forEach(p => {
                    if (p.length > 3 && !stopwords.has(p) && isNaN(p)) {
                        // Conteo General
                        contPalabras[p] = (contPalabras[p] || 0) + 1;

                        // Conteo Emocional (Busqueda parcial, ej: "amarlo" contiene "amar")
                        for (const [raiz, icono] of Object.entries(diccionarioEmociones)) {
                            if (p.includes(raiz)) {
                                const key = `${raiz} ${icono}`; // Ej: "muerte 💀"
                                contEmociones[key] = (contEmociones[key] || 0) + 1;
                            }
                        }
                    }
                });
            }
        });

        // Ordenar y cortar Tops
        const topPersonajes = Object.entries(contPersonajes).sort((a,b) => b[1]-a[1]).slice(0, 8);
        const topPalabras = Object.entries(contPalabras).sort((a,b) => b[1]-a[1]).slice(0, 10);
        const topEmociones = Object.entries(contEmociones).sort((a,b) => b[1]-a[1]).slice(0, 6);

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