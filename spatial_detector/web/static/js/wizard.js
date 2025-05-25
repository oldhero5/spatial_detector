/**
 * Setup wizard functionality for Spatial Detector
 */

// DOM Elements
const wizardElement = document.getElementById('setup-wizard');
const wizardCloseButton = document.getElementById('close-wizard');
const wizardPrevButton = document.getElementById('wizard-prev');
const wizardNextButton = document.getElementById('wizard-next');
const sourceButtons = document.querySelectorAll('.source-button');
const wizardCameraSelect = document.getElementById('wizard-camera-select');
const wizardWebcamTest = document.getElementById('wizard-test-webcam');
const wizardWebcamPreview = document.getElementById('wizard-webcam-preview');
const wizardQrCode = document.getElementById('wizard-qr-code');
const wizardDirectLink = document.getElementById('wizard-direct-link');
const wizardSkipCalibration = document.getElementById('wizard-skip-calibration');
const wizardStartCalibration = document.getElementById('wizard-start-calibration');
const wizardFinish = document.getElementById('wizard-finish');

// Wizard state
let currentStep = 1;
let selectedSource = null;
let wizardTestStream = null;

/**
 * Initialize wizard functionality
 */
document.addEventListener('DOMContentLoaded', () => {
    initWizardEvents();
});

/**
 * Initialize wizard event handlers
 */
function initWizardEvents() {
    // Close button
    wizardCloseButton.addEventListener('click', () => {
        closeWizard();
    });

    // Navigation buttons
    wizardPrevButton.addEventListener('click', () => {
        navigateWizard(-1);
    });

    wizardNextButton.addEventListener('click', () => {
        navigateWizard(1);
    });

    // Source selection
    sourceButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            selectedSource = button.dataset.source;
            sourceButtons.forEach(b => b.classList.remove('selected'));
            button.classList.add('selected');

            // Enable next button
            wizardNextButton.disabled = false;
        });
    });

    // Webcam test
    wizardWebcamTest.addEventListener('click', async () => {
        if (wizardTestStream) {
            // Stop existing stream
            wizardTestStream.getTracks().forEach(track => track.stop());
            wizardTestStream = null;
            wizardWebcamTest.textContent = 'Test Camera';

            // Clear preview
            const videoElement = wizardWebcamPreview.querySelector('video');
            if (videoElement) {
                videoElement.srcObject = null;
            }

            return;
        }

        // Start camera preview
        try {
            // Check if mediaDevices is available
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                console.error('getUserMedia not available');
                console.error('Current protocol:', window.location.protocol);
                console.error('navigator.mediaDevices:', navigator.mediaDevices);
                alert('Camera access not available. Please ensure you are using HTTPS and have accepted the security certificate.');
                return;
            }

            const deviceId = wizardCameraSelect.value;
            const constraints = {
                video: deviceId ? { deviceId: { exact: deviceId } } : true
            };

            wizardTestStream = await navigator.mediaDevices.getUserMedia(constraints);

            // Create video element if it doesn't exist
            let videoElement = wizardWebcamPreview.querySelector('video');
            if (!videoElement) {
                videoElement = document.createElement('video');
                videoElement.autoplay = true;
                videoElement.playsinline = true;
                wizardWebcamPreview.appendChild(videoElement);
            }

            videoElement.srcObject = wizardTestStream;
            wizardWebcamTest.textContent = 'Stop Camera';

            // Enable next button
            wizardNextButton.disabled = false;
        } catch (error) {
            console.error('Error starting camera:', error);
            alert('Could not start camera: ' + error.message);
        }
    });

    // Skip calibration
    wizardSkipCalibration.addEventListener('click', () => {
        navigateWizard(1);
    });

    // Start calibration
    wizardStartCalibration.addEventListener('click', () => {
        // In a real implementation, this would start the calibration process
        // For now, just proceed to next step
        navigateWizard(1);
    });

    // Finish wizard
    wizardFinish.addEventListener('click', () => {
        completeWizard();
    });

    // Populate camera select on wizard load
    populateWizardCameraSelect();
}

/**
 * Navigate through wizard steps
 */
function navigateWizard(direction) {
    // Hide current step
    const currentStepElement = document.querySelector(`.wizard-step[data-step="${currentStep}"]`);
    const progressIndicators = document.querySelectorAll('.wizard-progress span');

    if (currentStepElement) {
        currentStepElement.classList.add('hidden');
    }

    // Update step number
    currentStep += direction;

    // Handle source-specific steps
    let nextStepSelector = `.wizard-step[data-step="${currentStep}"]`;
    if (currentStep === 2 && selectedSource) {
        nextStepSelector = `.wizard-step[data-step="2-${selectedSource}"]`;
    }

    // Show next step
    const nextStepElement = document.querySelector(nextStepSelector);
    if (nextStepElement) {
        nextStepElement.classList.remove('hidden');

        // Update progress indicators
        progressIndicators.forEach((indicator, index) => {
            if (index < currentStep) {
                indicator.classList.add('active');
            } else {
                indicator.classList.remove('active');
            }
        });

        // Update navigation buttons
        wizardPrevButton.disabled = currentStep === 1;

        // Special logic for final step
        if (currentStep === 4) {
            wizardNextButton.classList.add('hidden');
        } else {
            wizardNextButton.classList.remove('hidden');
        }

        // Generate iPhone connection code if needed
        if (nextStepSelector === '.wizard-step[data-step="2-iphone"]') {
            generateWizardConnectionCode();
        }
    }
}

/**
 * Populate camera select dropdown in wizard
 */
async function populateWizardCameraSelect() {
    try {
        // Check if mediaDevices is available
        if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
            console.error('enumerateDevices not available');
            console.error('Current protocol:', window.location.protocol);
            console.error('navigator.mediaDevices:', navigator.mediaDevices);
            wizardCameraSelect.innerHTML = '<option>Camera access not available</option>';
            wizardCameraSelect.disabled = true;
            return;
        }

        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');

        // Clear and populate camera select
        wizardCameraSelect.innerHTML = '';
        videoDevices.forEach(device => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            option.text = device.label || `Camera ${wizardCameraSelect.options.length + 1}`;
            wizardCameraSelect.appendChild(option);
        });

        if (videoDevices.length > 0) {
            wizardWebcamTest.disabled = false;
        }
    } catch (error) {
        console.error('Error enumerating devices:', error);
    }
}

/**
 * Generate connection code for iPhone
 */
function generateWizardConnectionCode() {
    // Show loading state
    wizardQrCode.innerHTML = `
        <div class="loading-indicator">
            <div class="loading-spinner"></div>
            <span>Generating QR code...</span>
        </div>
    `;

    // Fetch QR code from server
    fetch('/api/qrcode')
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to generate QR code');
            }
            return response.json();
        })
        .then(data => {
            if (data && data.qr_code) {
                // Display the QR code
                wizardQrCode.innerHTML = `
                    <img src="data:image/png;base64,${data.qr_code}" alt="Connection QR Code" style="max-width: 200px; max-height: 200px;">
                `;

                // Display the connection URL
                const connectionUrl = data.url || window.location.origin;
                wizardDirectLink.textContent = connectionUrl;

                // Enable next button
                wizardNextButton.disabled = false;
            } else {
                throw new Error('Invalid QR code data');
            }
        })
        .catch(error => {
            console.error('Error generating QR code:', error);
            // Fallback to text display
            const connectionUrl = `${window.location.origin}/connect/${Date.now()}`;
            wizardDirectLink.textContent = connectionUrl;
            wizardQrCode.innerHTML = `
                <div style="padding: 20px; background: #f0f0f0; border: 1px solid #ccc; border-radius: 4px;">
                    <p style="text-align: center; color: #666;">QR Code generation failed</p>
                    <p style="text-align: center; font-size: 14px; margin-top: 10px;">Use the link below instead</p>
                </div>
            `;
            // Still enable next button for fallback
            wizardNextButton.disabled = false;
        });
}

/**
 * Complete the wizard and start using the app
 */
function completeWizard() {
    // Stop test stream if active
    if (wizardTestStream) {
        wizardTestStream.getTracks().forEach(track => track.stop());
        wizardTestStream = null;
    }

    // Apply selected settings to main app
    if (selectedSource === 'webcam' && wizardCameraSelect.value) {
        // Set the camera in the main app
        const mainCameraSelect = document.getElementById('camera-select');
        if (mainCameraSelect) {
            mainCameraSelect.value = wizardCameraSelect.value;
        }

        // Start the camera
        if (window.cameraManager) {
            window.cameraManager.startCamera();
        }
    }

    // Mark setup as completed
    localStorage.setItem('spatial-detector-setup-completed', 'true');

    // Close wizard
    closeWizard();
}

/**
 * Close the wizard
 */
function closeWizard() {
    // Stop test stream if active
    if (wizardTestStream) {
        wizardTestStream.getTracks().forEach(track => track.stop());
        wizardTestStream = null;
    }

    // Hide wizard
    wizardElement.classList.add('hidden');
}
