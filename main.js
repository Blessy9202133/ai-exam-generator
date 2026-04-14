// Application state
let currentGeneratedExam = null;
let uploadedText = "";

document.addEventListener('DOMContentLoaded', () => {
    // Automatically display results table on dashboard load
    showMockResults();

    // 1. Handle File Upload & PDF Extraction
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-upload');
    const fileNameDisplay = document.getElementById('file-name-display');

    dropZone.addEventListener('click', () => fileInput.click());

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        if (e.dataTransfer.files.length) {
            handleFile(e.dataTransfer.files[0]);
        }
    });

    fileInput.addEventListener('change', () => {
        if (fileInput.files.length) {
            handleFile(fileInput.files[0]);
        }
    });

    async function handleFile(file) {
        fileNameDisplay.textContent = `Extracting text from: ${file.name}... Please wait.`;

        try {
            if (file.type === "application/pdf") {
                uploadedText = await extractTextFromPDF(file);
            } else if (file.type === "text/plain") {
                uploadedText = await file.text();
            } else {
                throw new Error("Unsupported file format. Please upload a PDF or TXT.");
            }
            fileNameDisplay.textContent = `✅ Successfully extracted text from: ${file.name}`;
            fileNameDisplay.style.color = 'var(--success)';
        } catch (error) {
            fileNameDisplay.textContent = `❌ Error: ${error.message}`;
            fileNameDisplay.style.color = 'var(--danger)';
            uploadedText = "";
        }
    }

    async function extractTextFromPDF(file) {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let textContent = "";

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContentObj = await page.getTextContent();
            textContent += textContentObj.items.map(item => item.str).join(" ") + " ";
        }
        return textContent;
    }

    // 2. Handle Generation Form
    const form = document.getElementById('generator-form');
    const btnText = document.querySelector('.btn-text');
    const loader = document.querySelector('.loader');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!uploadedText) {
            alert('Please upload a document first!');
            return;
        }

        const title = document.getElementById('exam-title').value;
        const count = document.getElementById('question-count').value;
        const diff = document.getElementById('difficulty').value;

        // UI Loading State
        btnText.style.display = 'none';
        loader.style.display = 'block';

        // Simulate AI Processing time visually so the user can see the effect
        await new Promise(resolve => setTimeout(resolve, 2000));

        currentGeneratedExam = generateMockData(title, count, diff);
        renderPreview(currentGeneratedExam);

        // Reset UI
        btnText.style.display = 'block';
        loader.style.display = 'none';

        // Scroll down to showcase
        document.querySelector('.preview-panel').scrollIntoView({ behavior: 'smooth' });
    });

    // 3. Publishing
    const publishBtn = document.getElementById('publish-btn');
    const modal = document.getElementById('publish-modal');
    const closeBtn = document.querySelector('.close-btn');
    const copyBtn = document.getElementById('copy-link-btn');
    const shareLink = document.getElementById('share-link');

    publishBtn.addEventListener('click', async () => {
        // Generate a random ID for local reference
        const fakeId = Math.random().toString(36).substring(7);
        localStorage.setItem(`exam_${fakeId}`, JSON.stringify(currentGeneratedExam));

        // 1. Create the full long URL
        const encodedData = btoa(unescape(encodeURIComponent(JSON.stringify(currentGeneratedExam))));
        const longUrl = `${window.location.origin}/ai-exam-generator/exam.html?id=${fakeId}&data=${encodedData}`;

        // 2. Show loading state in the link box
        shareLink.value = "Shortening link... Please wait.";
        modal.classList.add('active');

        // 3. Attempt to shorten the link via is.gd API
        try {
            // We use a proxy-like approach or direct fetch if CORS allows. 
            // is.gd is usually friendly.
            const response = await fetch(`https://is.gd/create.php?format=json&url=${encodeURIComponent(longUrl)}`);
            const data = await response.json();
            
            if (data.shorturl) {
                shareLink.value = data.shorturl;
            } else {
                shareLink.value = longUrl; // Fallback
            }
        } catch (error) {
            console.warn("Shortener failed, using long link:", error);
            shareLink.value = longUrl; // Fallback
        }

        // Show demo results after publishing
        showMockResults();
    });

    closeBtn.addEventListener('click', () => modal.classList.remove('active'));

    copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(shareLink.value);
        copyBtn.textContent = 'Copied!';
        setTimeout(() => copyBtn.textContent = 'Copy', 2000);
    });
});

function renderPreview(examData) {
    const previewArea = document.getElementById('preview-content');
    const actions = document.getElementById('preview-actions');

    previewArea.innerHTML = '';
    previewArea.classList.remove('preview-empty');

    examData.questions.forEach((q, index) => {
        const card = document.createElement('div');
        card.classList.add('question-card');

        let optionsHtml = '';
        q.options.forEach((opt, oIndex) => {
            const isCorrect = oIndex === q.correctAnswer;
            optionsHtml += `
                <div class="option ${isCorrect ? 'correct' : ''}">
                    <input type="radio" disabled ${isCorrect ? 'checked' : ''}>
                    <label>${opt}</label>
                </div>
            `;
        });

        card.innerHTML = `
            <h3>${index + 1}. ${q.qText}</h3>
            <div class="optionsbox">
                ${optionsHtml}
            </div>
        `;
        previewArea.appendChild(card);
    });

    document.querySelector('.preview-header .badge').textContent = 'Ready to Publish';
    document.querySelector('.preview-header .badge').style.background = 'var(--success)';
    actions.style.display = 'flex';
}

async function showMockResults() {
    const section = document.getElementById('results-section');
    const tbody = document.getElementById('results-table-body');
    section.style.display = 'block';

    // 🚀 Fetch live results from Google Sheets
    const GOOGLE_SHEET_URL = "https://script.google.com/macros/s/AKfycbwbm7hTa15Z6PT8HSMOKoUjiarsbvQwDcatGZuN8dZq2QiIUotilC40_1O8GLlGAj1Xfw/exec";
    let results = [];

    if (GOOGLE_SHEET_URL.startsWith('http')) {
        try {
            const res = await fetch(GOOGLE_SHEET_URL);
            results = await res.json();
            document.querySelector('#results-section h2').innerHTML = "Live Sheet Results <span style='font-size:12px; color:var(--success)'>🟢 Connected to Google</span>";
        } catch (e) {
            console.error("Failed to load live results from sheet", e);
        }
    }

    // Fallback if URL is not set or network failed
    if (results.length === 0) {
        results = JSON.parse(localStorage.getItem('mock_results') || '[]');
    }

    if(results.length === 0) {
        results = [
            { name: 'System Message', exam: 'Please set up your Google Sheet URL!', score: '0%', status: 'Fail', date: 'Present' }
        ];
    }

    tbody.innerHTML = results.map(r => `
        <tr>
            <td>${r.name}</td>
            <td>${r.exam}</td>
            <td>${r.score}</td>
            <td class="${r.status === 'Pass' ? 'status-pass' : 'status-fail'}">${r.status}</td>
            <td>${r.date}</td>
        </tr>
    `).join('');
}

function generateMockData(title, count, diff) {
    // This mocks exactly what the Gemini API would return in JSON schema
    const questions = [];
    for(let i=0; i<Math.min(count, 50); i++) {
        questions.push({
            qText: `Which of the following best describes a core concept in the attached "${title}" document? (Difficulty: ${diff})`,
            options: [
                "A highly plausible but incorrect distractor.",
                "The actual correct answer directly sourced from the document.",
                "A generalized statement that isn't specifically accurate.",
                "Another very common misconception."
            ],
            correctAnswer: 1
        });
    }
    return { title, questions };
}
