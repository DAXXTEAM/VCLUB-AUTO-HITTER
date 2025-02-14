'use strict';

// Stripe Helper Script with Start/Stop and Email Button
(function () {
  if (window.stripeHelperInjected) return;
  window.stripeHelperInjected = true;

  const config = {
    // Function to generate random names
    generateRandomName: () => {
      const firstNames = ['Alex', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Avery', 'Quinn', 'Sage', 'Parker', 
        'Sam', 'Jamie', 'Drew', 'Blake', 'Charlie', 'Skylar', 'Robin', 'Ashley', 'Leslie', 'Tracy'];
      const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
        'Anderson', 'Taylor', 'Thomas', 'Moore', 'Jackson', 'Martin', 'Lee', 'Thompson', 'White', 'Harris'];
      const randomFirst = firstNames[Math.floor(Math.random() * firstNames.length)];
      const randomLast = lastNames[Math.floor(Math.random() * lastNames.length)];
      return `${randomFirst} ${randomLast}`;
    },
    urls: [
      'cs_live', // Target all URLs containing 'cs_live'
      'buy.stripe.com', 
      'api.stripe.com', 
      'invoice.stripe.com', 
      'checkout.stripe.com',
      'checkout.', 
      'billing.',  
      'invoice.',
      'payment.',
      'pay.',
      'secure.'
    ],
    fields: {
      billingName: 'input[name="billingName"], input[name="name"], input[autocomplete*="name"]',
      addressLine1: 'input[name="billingAddressLine1"], input[name="addressLine1"], input[autocomplete*="address-line1"]',
      addressLine2: 'input[name="billingAddressLine2"], input[name="addressLine2"], input[autocomplete*="address-line2"]',
      city: 'input[name="billingLocality"], input[name="city"], input[autocomplete*="city"]',
      country: 'select[name="billingCountry"], select[name="country"], select[autocomplete*="country"]',
      state: 'input[name="billingAdministrativeArea"], select[name="state"], select[autocomplete*="state"]',
      postalCode: 'input[name="billingPostalCode"], input[name="postalCode"], input[autocomplete*="postal-code"]',
      cardNumber: 'input[name="cardNumber"], input[name*="card"], input[data-elements-stable-field-name*="cardNumber"], input[aria-label*="card"], input[placeholder*="card"], iframe[name*="card"], [data-fieldtype="number"]',
      cardExpiry: 'input[name="cardExpiry"], input[name*="expir"], input[data-elements-stable-field-name*="cardExpiry"], input[aria-label*="expir"], input[placeholder*="MM"], iframe[name*="expir"], [data-fieldtype="expiry"]',
      cardCvc: 'input[name="cardCvc"], input[name*="cvc"], input[name*="cvv"], input[data-elements-stable-field-name*="cardCvc"], input[aria-label*="CVC"], input[placeholder*="CVC"], iframe[name*="cvc"], [data-fieldtype="cvc"]',
      email: 'input[type="email"], input[name="email"], input[autocomplete*="email"]'
    },
    addresses: {
      macau: {
        get name() { return config.generateRandomName(); }, // Use getter for dynamic name generation
        addressLine1: '123 Main Street',
        addressLine2: 'OK',
        city: 'Macao',
        country: 'MO',
        state: 'Macau',
        postalCode: '999078',
        cardNumber: '0',
        cardExpiry: '12/32',
        cardCvc: '000',
        email: 'daxx@daxxteam.com'
      }
    }
  };

  class StripeHelper {
    constructor() {
      this.isVisible = false;
      this.isRunning = false;
      this.binInput = '';
      this.emailInput = '';
      this.retryInterval = null;
      this.currentAddress = 'macau';
      this.init();
    }

    async loadStorage() {
      return new Promise((resolve) => {
        chrome.storage.local.get(['bin', 'email'], (result) => {
          this.binInput = result.bin || '';
          this.emailInput = result.email || '';
          resolve();
        });
      });
    }

    toggleStartStop() {
      this.isRunning = !this.isRunning;

      if (this.isRunning) {
        this.fillFields();
        this.unlockFields();
        this.startAutoRetry();
        this.showToast('✓ Started: 😉');
      } else {
        this.stopAutoRetry();
        this.showToast('✓ Stopped: Auto-retry disabled');
      }

      this.updateStartStopButton();
    }

    updateStartStopButton() {
      if (this.startStopButton) {
        this.startStopButton.innerHTML = `${this.isRunning ? '⏹️' : '▶️'} ${this.isRunning ? 'Stop' : 'Start'}`;
      }
    }

    fillFields() {
      const address = config.addresses[this.currentAddress] || {};
      let filledCount = 0;
      
      // Generate a new random name for each fill
      const randomName = config.generateRandomName();

      const iframes = document.querySelectorAll('iframe[name*="card"], iframe[name*="expir"], iframe[name*="cvc"]');
      iframes.forEach(iframe => {
        try {
          const input = iframe.contentDocument.querySelector('input');
          if (input) {
            if (iframe.name.includes('card')) input.value = address.cardNumber || '0';
            if (iframe.name.includes('expir')) input.value = address.cardExpiry || '0';
            if (iframe.name.includes('cvc')) input.value = address.cardCvc || '0';
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            filledCount++;
          }
        } catch (e) {
          // Silent fail for cross-origin iframes
        }
      });

      Object.entries(config.fields).forEach(([key, selector]) => {
        const field = document.querySelector(selector);
        if (field) {
          field.value = address[key] || 'ＶＣｌｕｂ';
          // Use the same random name for name fields, address values for others
          field.value = key === 'billingName' ? randomName : (address[key] || '');
          field.dispatchEvent(new Event('input', { bubbles: true }));
          field.dispatchEvent(new Event('change', { bubbles: true }));
          filledCount++;
        }
      });

      if (this.emailInput) {
        const emailField = document.querySelector(config.fields.email);
        if (emailField) {
          emailField.value = this.emailInput;
          emailField.dispatchEvent(new Event('input', { bubbles: true }));
          emailField.dispatchEvent(new Event('change', { bubbles: true }));
          filledCount++;
        }
      }

      this.showToast(``);
    }

    unlockFields() {
      const fields = document.querySelectorAll('input[disabled], select[disabled], input[readonly], select[readonly]');
      fields.forEach(field => {
        field.removeAttribute('disabled');
        field.removeAttribute('readonly');
      });
      this.showToast('');
    }

    startAutoRetry() {
      this.retryInterval = setInterval(() => {
        const submitBtn = document.querySelector('.SubmitButton, button[type="submit"], input[type="submit"]');
        if (submitBtn) submitBtn.click();
      }, 2000);
    }

    stopAutoRetry() {
      if (this.retryInterval) {
        clearInterval(this.retryInterval);
        this.retryInterval = null;
      }
    }

    showToast(message) {
      const toast = document.createElement('div');
      Object.assign(toast.style, {
        position: 'fixed',
        top: '70px',
        right: '20px',
        background: 'rgba(10, 10, 15, 0.95)',
        color: '#fff',
        padding: '6px 10px',
        borderRadius: '4px',
        fontSize: '10px',
        zIndex: '1000000',
        boxShadow: '0 0 10px rgba(0, 0, 0, 0.3)',
        border: '1px solid rgba(255, 255, 255, 0.1)'
      });
      toast.textContent = message;
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 1500);
    }

    createStyles() {
      return {
        container: {
          position: 'fixed',
          top: '20px',
          right: this.isVisible ? '0' : '-140px',
          zIndex: '999999',
          backgroundColor: 'rgba(10, 10, 15, 0.95)',
          padding: '10px',
          borderRadius: '10px 0 0 10px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRight: 'none',
          backdropFilter: 'blur(5px)',
          transition: 'right 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          width: '140px'
        },
        button: {
          width: '100%',
          padding: '8px',
          margin: '4px 0',
          background: 'linear-gradient(145deg, #1e1e2d 0%, #2a2a3a 100%)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '6px',
          color: '#fff',
          cursor: 'pointer',
          fontSize: '12px',
          fontWeight: '500',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
          userSelect: 'none',
          outline: 'none',
          position: 'relative',
          overflow: 'hidden'
        },
        toggleBtn: {
          position: 'absolute',
          left: '-20px',
          top: '50%',
          transform: 'translateY(-50%)',
          background: 'linear-gradient(145deg, #1e1e2d 0%, #2a2a3a 100%)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '4px 0 0 4px',
          color: '#fff',
          cursor: 'pointer',
          fontSize: '14px',
          padding: '8px 4px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          userSelect: 'none',
          outline: 'none'
        },
        branding: {
          position: 'fixed',
          bottom: '20px',
          left: '20px',
          zIndex: '999999',
          color: '#fff',
          fontSize: '16px',
          fontWeight: '600',
          fontFamily: 'Arial, sans-serif',
          textShadow: '0 2px 4px rgba(0, 0, 0, 0.3)',
          padding: '8px 12px',
          borderRadius: '6px',
          background: 'rgba(10, 10, 15, 0.95)',
          backdropFilter: 'blur(5px)',
          boxShadow: '0 0 10px rgba(0, 0, 0, 0.3)',
          border: '1px solid rgba(255, 255, 255, 0.1)'
        }
      };
    }

    createButton(text, onClick, icon = '') {
      const button = document.createElement('button');
      Object.assign(button.style, this.createStyles().button);
      button.style.boxShadow = '0 0 5px rgba(255, 255, 255, 0.2), 0 2px 4px rgba(0, 0, 0, 0.2)';
      button.innerHTML = `<span style="display: flex; align-items: center; gap: 6px;">${icon} ${text}</span>`;

      button.addEventListener('mouseover', () => {
        button.style.background = 'linear-gradient(145deg, #2a2a3a 0%, #1e1e2d 100%)';
        button.style.transform = 'translateY(-1px)';
        button.style.boxShadow = '0 0 10px rgba(255, 255, 255, 0.3), 0 4px 8px rgba(0, 0, 0, 0.3)';
      });

      button.addEventListener('mouseout', () => {
        button.style.background = 'linear-gradient(145deg, #1e1e2d 0%, #2a2a3a 100%)';
        button.style.transform = 'translateY(0)';
        button.style.boxShadow = '0 0 5px rgba(255, 255, 255, 0.2), 0 2px 4px rgba(0, 0, 0, 0.2)';
      });

      button.addEventListener('mousedown', () => {
        button.style.transform = 'translateY(1px)';
        button.style.boxShadow = '0 0 3px rgba(255, 255, 255, 0.1), 0 1px 2px rgba(0, 0, 0, 0.2)';
      });

      button.addEventListener('mouseup', () => {
        button.style.transform = 'translateY(-1px)';
        button.style.boxShadow = '0 0 10px rgba(255, 255, 255, 0.3), 0 4px 8px rgba(0, 0, 0, 0.3)';
      });

      button.addEventListener('click', onClick);
      return button;
    }

    createBranding() {
      const branding = document.createElement('div');
      Object.assign(branding.style, this.createStyles().branding);
      branding.textContent = '𝖵𝖢𝗅𝗎𝖻 - 𝖳𝖾𝖼𝗁 𝖠𝗎𝗍𝗈 𝖢𝗈 𝖧𝗂𝗍𝗍𝖾𝗋™';
      document.body.appendChild(branding);
    }

    toggleVisibility() {
      this.isVisible = !this.isVisible;
      this.container.style.right = this.isVisible ? '0' : '-140px';
      this.toggleBtn.textContent = this.isVisible ? '»' : '«';
    }

    createInterface() {
      const styles = this.createStyles();

      this.container = document.createElement('div');
      Object.assign(this.container.style, styles.container);

      this.toggleBtn = document.createElement('button');
      Object.assign(this.toggleBtn.style, styles.toggleBtn);
      this.toggleBtn.textContent = '«';
      this.toggleBtn.onclick = () => this.toggleVisibility();

      const binButton = this.createButton('Enter BIN', () => this.showBinDialog(), '💳');
      const emailButton = this.createButton('Set Email', () => this.showEmailDialog(), '📧');
      this.startStopButton = this.createButton(this.isRunning ? 'Stop' : 'Start', () => this.toggleStartStop(), this.isRunning ? '⏹️' : '▶️');

      const buttons = [binButton, emailButton, this.startStopButton];

      buttons.forEach(btn => this.container.appendChild(btn));
      this.container.appendChild(this.toggleBtn);
      document.body.appendChild(this.container);

      this.createBranding();
    }

    showBinDialog() {
      const dialog = document.createElement('div');
      Object.assign(dialog.style, {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        background: 'rgba(10, 10, 15, 0.95)',
        padding: '20px',
        borderRadius: '10px',
        zIndex: '1000001',
        boxShadow: '0 0 15px rgba(255, 255, 255, 0.2), 0 0 30px rgba(255, 255, 255, 0.1)',
        width: '300px'
      });

      const input = document.createElement('input');
      Object.assign(input.style, {
        width: '100%',
        padding: '8px',
        marginBottom: '10px',
        background: 'rgba(30, 30, 30, 0.9)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '5px',
        color: '#fff',
        boxSizing: 'border-box',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        outline: 'none'
      });
      input.value = this.binInput;
      input.placeholder = 'Enter BIN (e.g., 424242)';
      
      input.addEventListener('focus', () => {
        input.style.borderColor = 'rgba(255, 255, 255, 0.3)';
        input.style.boxShadow = '0 0 0 2px rgba(255, 255, 255, 0.1)';
      });

      input.addEventListener('blur', () => {
        input.style.borderColor = 'rgba(255, 255, 255, 0.1)';
        input.style.boxShadow = 'none';
      });

      const saveButton = document.createElement('button');
      Object.assign(saveButton.style, {
        width: '100%',
        padding: '8px',
        background: 'rgba(30, 30, 30, 0.9)',
        border: 'none',
        borderRadius: '5px',
        color: '#fff',
        cursor: 'pointer',
        boxShadow: '0 0 2px #ff0000, 0 0 4px #00ff00, 0 0 6px #0000ff'
      });
      saveButton.textContent = 'Save BIN';

      saveButton.onclick = () => {
        const binValue = input.value.trim();
        if (binValue) {
          chrome.storage.local.set({ bin: binValue }, () => {
            this.binInput = binValue;
            this.showToast('✓ BIN saved successfully');
            dialog.remove();
          });
        } else {
          this.showToast('⚠️ Please enter a valid BIN');
        }
      };

      dialog.appendChild(input);
      dialog.appendChild(saveButton);
      document.body.appendChild(dialog);
      input.focus();
    }

    showEmailDialog() {
      const dialog = document.createElement('div');
      Object.assign(dialog.style, {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        background: 'rgba(10, 10, 15, 0.95)',
        padding: '20px',
        borderRadius: '10px',
        zIndex: '1000001',
        boxShadow: '0 0 2px #ff0000, 0 0 4px #00ff00, 0 0 6px #0000ff',
        width: '300px'
      });

      const input = document.createElement('input');
      Object.assign(input.style, {
        width: '100%',
        padding: '8px',
        marginBottom: '10px',
        background: 'rgba(30, 30, 30, 0.9)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '5px',
        color: '#fff',
        boxSizing: 'border-box',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        outline: 'none'
      });
      input.value = this.emailInput;
      input.placeholder = 'Enter Email (e.g., daxx@daxxteam.com)';
      
      input.addEventListener('focus', () => {
        input.style.borderColor = 'rgba(255, 255, 255, 0.3)';
        input.style.boxShadow = '0 0 0 2px rgba(255, 255, 255, 0.1)';
      });

      input.addEventListener('blur', () => {
        input.style.borderColor = 'rgba(255, 255, 255, 0.1)';
        input.style.boxShadow = 'none';
      });

      const saveButton = document.createElement('button');
      Object.assign(saveButton.style, {
        width: '100%',
        padding: '8px',
        background: 'rgba(30, 30, 30, 0.9)',
        border: 'none',
        borderRadius: '5px',
        color: '#fff',
        cursor: 'pointer',
        boxShadow: '0 0 2px #ff0000, 0 0 4px #00ff00, 0 0 6px #0000ff'
      });
      saveButton.textContent = 'Save Email';

      saveButton.onclick = () => {
        const emailValue = input.value.trim();
        if (emailValue) {
          chrome.storage.local.set({ email: emailValue }, () => {
            this.emailInput = emailValue;
            this.showToast('✓ Email saved successfully');
            dialog.remove();
          });
        } else {
          this.showToast('⚠️ Please enter a valid email');
        }
      };

      dialog.appendChild(input);
      dialog.appendChild(saveButton);
      document.body.appendChild(dialog);
      input.focus();
    }

    async init() {
      if (!config.urls.some(url => window.location.href.includes(url))) return;

      await this.loadStorage();

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this.createInterface());
      } else {
        this.createInterface();
      }
    }
  }

  // Initialize Stripe Helper if on a Stripe-related page
  if (config.urls.some(url => window.location.href.includes(url))) {
    new StripeHelper();
  }
})();
document.addEventListener('DOMContentLoaded', () => {
  const replaceTextInDOM = () => {
    const replaceText = () => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
      let node;
      while (node = walker.nextNode()) {
        if (node.nodeValue.includes('Powered by')) {
          node.nodeValue = node.nodeValue.replace(/Powered by/g, "𝖵𝖢𝗅𝗎𝖻 - 𝖳𝖾𝖼𝗁 𝖠𝗎𝗍𝗈 𝖢𝗈 𝖧𝗂𝗍𝗍𝖾𝗋");
        }
      }
    };

    // Replace text immediately
    replaceText();

    // Use MutationObserver to handle dynamic changes
    const observer = new MutationObserver(replaceText);
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  };

  // Call the function to start the replacement
  replaceTextInDOM();
});

// hCaptcha Detection and Simulation Clicks with Polling
(function () {
  if (window.hCaptchaHelperInjected) return;
  window.hCaptchaHelperInjected = true;

  // Helper function to simulate mouse clicks
  function simulateMouseClick(element, clientX = null, clientY = null) {
    if (clientX === null || clientY === null) {
      const box = element.getBoundingClientRect();
      clientX = box.left + box.width / 2;
      clientY = box.top + box.height / 2;
    }

    if (isNaN(clientX) || isNaN(clientY)) {
      return;
    }

    // Send mouseover, mousedown, mouseup, click, mouseout
    const eventNames = [
      'mouseover',
      'mouseenter',
      'mousedown',
      'mouseup',
      'click',
      'mouseout',
    ];
    eventNames.forEach((eventName) => {
      const detail = eventName === 'mouseover' ? 0 : 1;
      const event = new MouseEvent(eventName, {
        detail: detail,
        view: window,
        bubbles: true,
        cancelable: true,
        clientX: clientX,
        clientY: clientY,
      });
      element.dispatchEvent(event);
    });
  }

  // Check if the hCaptcha widget frame is present
  function isWidgetFrame() {
    return document.querySelector('div.check') !== null;
  }

  // Check if the hCaptcha image frame is present
  function isImageFrame() {
    return document.querySelector('h2.prompt-text') !== null;
  }

  // Open the hCaptcha image frame
  function openImageFrame() {
    const anchor = document.querySelector('#anchor');
    if (anchor) {
      simulateMouseClick(anchor);
    }
  }

  // Check if the hCaptcha is solved
  function isSolved() {
    const checkDiv = document.querySelector('div.check');
    return checkDiv?.style?.display === 'block';
  }

  // Get the image URL from the hCaptcha challenge
  function getImageUrl(element) {
    const matches = element?.style?.background?.trim()?.match(/(?!^)".*?"/g);
    if (!matches || matches.length === 0) {
      return null;
    }
    return matches[0].replaceAll('"', '');
  }

  // Handle hCaptcha widget frame
  async function handleWidgetFrame() {
    if (isSolved()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
    openImageFrame();
  }

  // Handle hCaptcha image frame
  async function handleImageFrame() {
    // Wait for the hCaptcha task to be ready
    const task = document.querySelector('h2.prompt-text')?.innerText?.trim();
    if (!task) {
      return;
    }

    // Simulate clicks on hCaptcha images
    const imageCells = document.querySelectorAll('.task-image');
    if (imageCells.length === 0) {
      return;
    }

    // Convert NodeList to Array for easier manipulation
    const imageCellsArray = Array.from(imageCells);

    // Randomly shuffle the array
    const shuffledCells = imageCellsArray.sort(() => Math.random() - 0.5);

    // Select 3-4 random images to click
    const numberOfImagesToClick = Math.floor(Math.random() * 0) + 0; // Randomly choose between 3 and 4
    const selectedCells = shuffledCells.slice(0, numberOfImagesToClick);

    for (const cell of selectedCells) {
      const imageDiv = cell.querySelector('div.image');
      if (!imageDiv) {
        continue;
      }

      const imageUrl = getImageUrl(imageDiv);
      if (!imageUrl) {
        continue;
      }

      // Simulate a click on the image cell
      simulateMouseClick(cell);
      await new Promise((resolve) => setTimeout(resolve, 500)); // Add delay between clicks
    }

    // Submit the hCaptcha challenge
    const submitButton = document.querySelector('.button-submit');
    if (submitButton) {
      simulateMouseClick(submitButton);
    }
  }

  // Polling function to detect and handle hCaptcha
  async function pollForhCaptcha() {
    while (true) {
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Poll every 1 second

      if (isWidgetFrame()) {
        await handleWidgetFrame();
      } else if (isImageFrame()) {
        await handleImageFrame();
      }
    }
  }

  // Start polling for hCaptcha
  pollForhCaptcha();
})();