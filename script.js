  // Elementos do DOM

  const input       = document.getElementById('pdfInput');

  const fileName    = document.getElementById('fileName');

  const progressBar = document.getElementById('loadProgress');

  const btn         = document.getElementById('translateBtn');

  const status      = document.getElementById('status');

  const output      = document.getElementById('output');



  let fileBuffer = null;



  // Upload e barra de progresso

  input.addEventListener('change', () => {

    const file = input.files[0];

    if (!file) return;



    fileName.textContent = file.name;

    progressBar.style.display = 'inline-block';

    progressBar.value = 0;

    status.textContent = 'Carregando PDF... 0%';

    btn.disabled = true;

    output.style.display = 'none';



    const reader = new FileReader();

    reader.onprogress = e => {

      if (e.lengthComputable) {

        const pct = Math.round((e.loaded / e.total) * 100);

        progressBar.value = pct;

        status.textContent = `Carregando PDF... ${pct}%`;

      }

    };

    reader.onload = () => {

      fileBuffer = reader.result;

      progressBar.style.display = 'none';

      status.textContent = 'Carregado!';

      btn.disabled = false;

    };

    reader.onerror = () => {

      progressBar.style.display = 'none';

      status.textContent = 'Erro ao carregar PDF.';

    };

    reader.readAsArrayBuffer(file);

  });



  // Extração, tradução e geração do novo PDF

  btn.addEventListener('click', async () => {

    if (!fileBuffer) return;



    btn.disabled = true;

    status.textContent = 'Lendo texto do PDF…';



    // Extrai texto

    const pdf = await pdfjsLib.getDocument({ data: fileBuffer }).promise;

    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {

      const page    = await pdf.getPage(i);

      const content = await page.getTextContent();

      fullText     += content.items.map(item => item.str).join(' ') + '\n\n';

    }



    // Tradução via proxy + LibreTranslate

    status.textContent = 'Traduzindo conteúdo…';

    const proxyUrl = 'https://corsproxy.io/?' +

      encodeURIComponent('https://libretranslate.de/translate');



    const translated = await fetch(proxyUrl, {

      method: 'POST',

      headers: { 'Content-Type': 'application/json' },

      body: JSON.stringify({

        q:      fullText,

        source: 'auto',

        target: 'pt',

        format: 'text'

      })

    })

    .then(res => res.ok ? res.json() : Promise.reject(res.statusText))

    .then(json => json.translatedText)

    .catch(err => {

      console.error('Erro na tradução:', err);

      status.textContent = 'Falha na tradução.';

      return fullText; // fallback

    });



    // Exibe texto traduzido

    output.textContent = translated;

    output.style.display = 'block';

    status.textContent   = 'Gerando novo PDF…';



    // Gera PDF traduzido

    const { PDFDocument, StandardFonts } = PDFLib;

    const doc = await PDFDocument.create();

    const font = await doc.embedFont(StandardFonts.Helvetica);

    const size = 12, margin = 50;

    let page = doc.addPage(), y = page.getHeight() - margin;



    for (let line of splitIntoLines(translated, 80)) {

      if (y < margin) {

        page = doc.addPage();

        y    = page.getHeight() - margin;

      }

      page.drawText(line, { x: margin, y, size, font });

      y -= size + 4;

    }



    const pdfBytes = await doc.save();

    const blob     = new Blob([pdfBytes], { type: 'application/pdf' });

    const a        = document.createElement('a');

    a.href         = URL.createObjectURL(blob);

    a.download     = 'pdf_traduzido.pdf';

    a.click();



    status.textContent = 'PDF traduzido baixado com sucesso!';

    btn.disabled       = false;

  });



  // Quebra texto em linhas

  function splitIntoLines(text, maxChars) {

    const words = text.split(' ');

    const lines = [];

    let line     = '';

    for (const w of words) {

      if ((line + w).length > maxChars) {

        lines.push(line.trim());

        line = '';

      }

      line += w + ' ';

    }

    if (line.trim()) lines.push(line.trim());

    return lines;

  }

});
