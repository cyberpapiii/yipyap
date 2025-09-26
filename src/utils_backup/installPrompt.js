/**
 * Install Prompt Manager for YipYap PWA
 * Handles app installation prompts with smart timing and user engagement tracking
 */

class InstallPromptManager {
  constructor() {
    this.deferredPrompt = null;
    this.installPromptShown = false;
    this.userEngagementScore = 0;
    this.minEngagementThreshold = 15; // Minimum engagement score before showing prompt
    this.sessionStartTime = Date.now();

    this.initializePrompt();
    this.trackUserEngagement();
    this.loadInstallPreferences();
  }

  initializePrompt() {
    // Listen for the beforeinstallprompt event
    window.addEventListener('beforeinstallprompt', (event) => {
      console.log('beforeinstallprompt event fired');

      // Prevent the mini-infobar from appearing on mobile
      event.preventDefault();

      // Store the event so it can be triggered later
      this.deferredPrompt = event;

      // Check if we should show the install prompt
      this.evaluateInstallPrompt();
    });

    // Listen for app installation
    window.addEventListener('appinstalled', (event) => {
      console.log('PWA was installed');
      this.onAppInstalled();
    });

    // Check if app is already installed
    if (window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone === true) {
      console.log('App is running in standalone mode');
      this.onAppInstalled();
    }
  }

  // Track various user engagement metrics
  trackUserEngagement() {
    // Track page views
    this.incrementEngagement(1, 'page_view');

    // Track scroll depth
    let maxScrollDepth = 0;
    window.addEventListener('scroll', () => {
      const scrollDepth = Math.round((window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100);
      if (scrollDepth > maxScrollDepth && scrollDepth > 50) {
        maxScrollDepth = scrollDepth;
        this.incrementEngagement(2, 'deep_scroll');
      }
    }, { passive: true });

    // Track time spent on page
    setInterval(() => {
      const timeSpent = Math.floor((Date.now() - this.sessionStartTime) / 1000);
      if (timeSpent > 30 && timeSpent % 30 === 0) { // Every 30 seconds after first 30
        this.incrementEngagement(1, 'time_spent');
      }
    }, 1000);

    // Track interactions (clicks, taps)
    let interactionCount = 0;
    ['click', 'touchstart'].forEach(eventType => {
      document.addEventListener(eventType, () => {
        interactionCount++;
        if (interactionCount % 5 === 0) { // Every 5 interactions
          this.incrementEngagement(1, 'interaction');
        }
      }, { passive: true });
    });

    // Track social actions (votes, posts, comments)
    this.trackSocialEngagement();
  }

  // Track social engagement specific to YipYap
  trackSocialEngagement() {
    // This would be called from your app components
    window.addEventListener('yipyap:vote', () => {
      this.incrementEngagement(3, 'vote');
    });

    window.addEventListener('yipyap:post', () => {
      this.incrementEngagement(5, 'post_created');
    });

    window.addEventListener('yipyap:comment', () => {
      this.incrementEngagement(4, 'comment');
    });

    window.addEventListener('yipyap:share', () => {
      this.incrementEngagement(3, 'share');
    });
  }

  // Increment engagement score and evaluate install prompt
  incrementEngagement(points, action) {
    this.userEngagementScore += points;
    console.log(`Engagement +${points} for ${action}. Total: ${this.userEngagementScore}`);

    // Save to localStorage for persistence
    localStorage.setItem('yipyap_engagement_score', this.userEngagementScore.toString());

    // Check if we should show install prompt
    this.evaluateInstallPrompt();
  }

  // Load user preferences and engagement score
  loadInstallPreferences() {
    const savedScore = localStorage.getItem('yipyap_engagement_score');
    if (savedScore) {
      this.userEngagementScore = parseInt(savedScore, 10);
    }

    const installDismissed = localStorage.getItem('yipyap_install_dismissed');
    const dismissTime = localStorage.getItem('yipyap_install_dismiss_time');

    if (installDismissed && dismissTime) {
      const daysSinceDismiss = (Date.now() - parseInt(dismissTime, 10)) / (1000 * 60 * 60 * 24);
      // Reset dismissal after 7 days
      if (daysSinceDismiss > 7) {
        localStorage.removeItem('yipyap_install_dismissed');
        localStorage.removeItem('yipyap_install_dismiss_time');
      }
    }
  }

  // Evaluate whether to show install prompt
  evaluateInstallPrompt() {
    if (!this.deferredPrompt || this.installPromptShown) return;

    const isInstallDismissed = localStorage.getItem('yipyap_install_dismissed') === 'true';
    const isInstalled = this.isAppInstalled();

    if (isInstalled || isInstallDismissed) return;

    // Check engagement threshold
    if (this.userEngagementScore >= this.minEngagementThreshold) {
      // Add small delay to avoid interrupting user flow
      setTimeout(() => {
        this.showInstallPrompt();
      }, 2000);
    }
  }

  // Show custom install prompt UI
  showInstallPrompt() {
    if (this.installPromptShown) return;

    this.installPromptShown = true;

    // Create custom install prompt UI
    const promptContainer = document.createElement('div');
    promptContainer.id = 'install-prompt';
    promptContainer.innerHTML = `
      <div class="install-prompt-overlay">
        <div class="install-prompt-modal">
          <div class="install-prompt-header">
            <img src="/icons/icon-96x96.png" alt="YipYap" class="install-prompt-icon">
            <div>
              <h3>Install YipYap</h3>
              <p>Get the full experience with offline access and notifications</p>
            </div>
          </div>
          <div class="install-prompt-benefits">
            <div class="benefit">
              <span class="benefit-icon">⚡</span>
              <span>Faster loading</span>
            </div>
            <div class="benefit">
              <span class="benefit-icon">📱</span>
              <span>Works offline</span>
            </div>
            <div class="benefit">
              <span class="benefit-icon">🔔</span>
              <span>Push notifications</span>
            </div>
          </div>
          <div class="install-prompt-actions">
            <button id="install-btn" class="install-btn-primary">Install App</button>
            <button id="install-dismiss" class="install-btn-secondary">Not Now</button>
          </div>
        </div>
      </div>
    `;

    // Add styles
    const styles = `
      <style>
        .install-prompt-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
          animation: fadeIn 0.3s ease-out;
        }

        .install-prompt-modal {
          background: white;
          border-radius: 16px;
          padding: 24px;
          max-width: 400px;
          margin: 20px;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
          animation: slideUp 0.3s ease-out;
        }

        .install-prompt-header {
          display: flex;
          align-items: center;
          margin-bottom: 20px;
        }

        .install-prompt-icon {
          width: 48px;
          height: 48px;
          margin-right: 16px;
          border-radius: 12px;
        }

        .install-prompt-header h3 {
          margin: 0 0 4px 0;
          font-size: 20px;
          font-weight: 600;
          color: #1a73e8;
        }

        .install-prompt-header p {
          margin: 0;
          color: #666;
          font-size: 14px;
        }

        .install-prompt-benefits {
          margin-bottom: 24px;
        }

        .benefit {
          display: flex;
          align-items: center;
          margin-bottom: 12px;
          font-size: 14px;
        }

        .benefit-icon {
          width: 24px;
          margin-right: 12px;
          text-align: center;
        }

        .install-prompt-actions {
          display: flex;
          gap: 12px;
        }

        .install-btn-primary {
          flex: 1;
          background: #1a73e8;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 500;
          cursor: pointer;
        }

        .install-btn-secondary {
          flex: 1;
          background: transparent;
          color: #666;
          border: 1px solid #ddd;
          padding: 12px 24px;
          border-radius: 8px;
          font-size: 16px;
          cursor: pointer;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        @media (max-width: 480px) {
          .install-prompt-modal {
            margin: 20px;
            padding: 20px;
          }

          .install-prompt-actions {
            flex-direction: column;
          }
        }
      </style>
    `;

    document.head.insertAdjacentHTML('beforeend', styles);
    document.body.appendChild(promptContainer);

    // Handle install button click
    document.getElementById('install-btn').addEventListener('click', () => {
      this.handleInstallClick();
    });

    // Handle dismiss button click
    document.getElementById('install-dismiss').addEventListener('click', () => {
      this.handleInstallDismiss();
    });

    // Track prompt shown
    this.trackEvent('install_prompt_shown');
  }

  // Handle install button click
  async handleInstallClick() {
    if (!this.deferredPrompt) return;

    try {
      // Show the install prompt
      this.deferredPrompt.prompt();

      // Wait for the user to respond to the prompt
      const { outcome } = await this.deferredPrompt.userChoice;

      console.log(`User response to install prompt: ${outcome}`);
      this.trackEvent('install_prompt_response', { outcome });

      if (outcome === 'accepted') {
        console.log('User accepted the install prompt');
        this.onInstallAccepted();
      } else {
        console.log('User dismissed the install prompt');
        this.onInstallDismissed();
      }

      // Clear the deferred prompt
      this.deferredPrompt = null;

    } catch (error) {
      console.error('Error showing install prompt:', error);
    }

    // Remove the prompt UI
    this.removePromptUI();
  }

  // Handle install dismiss
  handleInstallDismiss() {
    this.onInstallDismissed();
    this.removePromptUI();
    this.trackEvent('install_prompt_dismissed');
  }

  // Remove prompt UI from DOM
  removePromptUI() {
    const promptElement = document.getElementById('install-prompt');
    if (promptElement) {
      promptElement.remove();
    }
  }

  // Handle install acceptance
  onInstallAccepted() {
    localStorage.setItem('yipyap_install_accepted', 'true');
    localStorage.setItem('yipyap_install_accept_time', Date.now().toString());
  }

  // Handle install dismissal
  onInstallDismissed() {
    localStorage.setItem('yipyap_install_dismissed', 'true');
    localStorage.setItem('yipyap_install_dismiss_time', Date.now().toString());
  }

  // Handle app installation completion
  onAppInstalled() {
    localStorage.setItem('yipyap_app_installed', 'true');
    localStorage.setItem('yipyap_install_time', Date.now().toString());

    // Show thank you message
    this.showInstallThankYou();

    this.trackEvent('app_installed');
  }

  // Show thank you message after installation
  showInstallThankYou() {
    const notification = document.createElement('div');
    notification.innerHTML = `
      <div style="
        position: fixed;
        top: 20px;
        right: 20px;
        background: #4caf50;
        color: white;
        padding: 16px 24px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 10000;
        max-width: 300px;
      ">
        <strong>Thanks for installing YipYap!</strong><br>
        You can now access the app from your home screen.
      </div>
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.remove();
    }, 5000);
  }

  // Check if app is installed
  isAppInstalled() {
    return window.matchMedia('(display-mode: standalone)').matches ||
           window.navigator.standalone === true ||
           localStorage.getItem('yipyap_app_installed') === 'true';
  }

  // Manual trigger for install prompt (e.g., from settings)
  triggerInstallPrompt() {
    if (this.deferredPrompt && !this.isAppInstalled()) {
      this.showInstallPrompt();
    }
  }

  // Track analytics events
  trackEvent(event, data = {}) {
    // Integration point for analytics
    if (window.gtag) {
      window.gtag('event', event, {
        event_category: 'PWA',
        ...data
      });
    }

    console.log('PWA Event:', event, data);
  }

  // Get install analytics data
  getInstallAnalytics() {
    return {
      engagementScore: this.userEngagementScore,
      isInstalled: this.isAppInstalled(),
      installDismissed: localStorage.getItem('yipyap_install_dismissed') === 'true',
      installAccepted: localStorage.getItem('yipyap_install_accepted') === 'true',
      installTime: localStorage.getItem('yipyap_install_time'),
      promptShown: this.installPromptShown
    };
  }
}

// Create and export singleton instance
const installPromptManager = new InstallPromptManager();

export default installPromptManager;