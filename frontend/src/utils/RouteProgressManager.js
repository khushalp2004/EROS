/**
 * RouteProgressManager.js
 * Handles animation timing and progress calculation for route-based movement
 */

class RouteProgressManager {
  constructor() {
    this.activeAnimations = new Map(); // routeId -> animationState
    this.speedProfiles = new Map(); // routeId -> speed settings
    this.defaultDuration = 30000; // 30 seconds default
  }

  // Start animation with realistic speed profile
  startRouteAnimation(routeId, totalDuration = null, speedProfile = 'normal') {
    const duration = totalDuration || this.defaultDuration;
    
    const animationState = {
      routeId,
      startTime: Date.now(),
      duration: duration, // milliseconds
      progress: 0, // 0 to 1
      status: 'active',
      speedProfile: speedProfile,
      onComplete: null
    };

    this.activeAnimations.set(routeId, animationState);
    console.log(`🎬 Started route animation for ${routeId}: ${duration}ms, ${speedProfile} speed`);
    return animationState;
  }

  // Calculate current progress based on time elapsed
  calculateProgress(routeId) {
    const animation = this.activeAnimations.get(routeId);
    if (!animation || animation.status !== 'active') return null;

    const elapsed = Date.now() - animation.startTime;
    const rawProgress = Math.min(elapsed / animation.duration, 1);
    
    // Apply speed profile (ease in/out for realistic movement)
    const easedProgress = this.applyEasingFunction(rawProgress, animation.speedProfile);
    
    animation.progress = easedProgress;
    return easedProgress;
  }

  // Realistic speed profiles for emergency vehicles
  applyEasingFunction(progress, speedProfile) {
    switch (speedProfile) {
      case 'emergency': // Faster acceleration, immediate response
        return this.easeOutCubic(progress);
      case 'cautious': // Slower, more deliberate
        return this.easeInOutQuad(progress);
      case 'instant': // No easing, constant speed
        return progress;
      case 'normal':
      default:
        return this.easeInOutCubic(progress);
    }
  }

  // Easing functions for realistic movement
  easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  easeInOutQuad(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  // Start animation with callback
  startRouteAnimationWithCallback(routeId, duration, speedProfile, onComplete) {
    const animation = this.startRouteAnimation(routeId, duration, speedProfile);
    animation.onComplete = onComplete;
    return animation;
  }

  // Pause animation
  pauseAnimation(routeId) {
    const animation = this.activeAnimations.get(routeId);
    if (animation && animation.status === 'active') {
      animation.status = 'paused';
      animation.pauseTime = Date.now();
      console.log(`⏸️ Paused animation for ${routeId}`);
    }
  }

  // Resume animation
  resumeAnimation(routeId) {
    const animation = this.activeAnimations.get(routeId);
    if (animation && animation.status === 'paused') {
      const pauseDuration = Date.now() - animation.pauseTime;
      animation.startTime += pauseDuration; // Adjust start time to account for pause
      animation.status = 'active';
      delete animation.pauseTime;
      console.log(`▶️ Resumed animation for ${routeId}`);
    }
  }

  // Stop animation
  stopAnimation(routeId) {
    const animation = this.activeAnimations.get(routeId);
    if (animation) {
      animation.status = 'stopped';
      console.log(`⏹️ Stopped animation for ${routeId}`);
      
      // Call completion callback if exists
      if (animation.onComplete) {
        animation.onComplete(routeId, 'stopped');
      }
      
      this.activeAnimations.delete(routeId);
    }
  }

  // Check animation status
  getAnimationStatus(routeId) {
    const animation = this.activeAnimations.get(routeId);
    return animation ? {
      routeId: animation.routeId,
      progress: animation.progress,
      status: animation.status,
      speedProfile: animation.speedProfile,
      elapsed: Date.now() - animation.startTime,
      duration: animation.duration
    } : null;
  }

  // Get all active animations
  getActiveAnimations() {
    return Array.from(this.activeAnimations.values()).filter(
      anim => anim.status === 'active'
    );
  }

  // Update progress and check for completion
  updateProgress(routeId) {
    const progress = this.calculateProgress(routeId);
    
    if (progress !== null) {
      const animation = this.activeAnimations.get(routeId);
      
      // Check if animation is complete
      if (progress >= 1 && animation.status === 'active') {
        animation.status = 'completed';
        console.log(`✅ Animation completed for ${routeId}`);
        
        // Call completion callback if exists
        if (animation.onComplete) {
          animation.onComplete(routeId, 'completed');
        }
        
        this.activeAnimations.delete(routeId);
      }
    }
    
    return progress;
  }

  // Set animation speed multiplier
  setSpeedMultiplier(routeId, multiplier) {
    const animation = this.activeAnimations.get(routeId);
    if (animation) {
      const remainingProgress = 1 - animation.progress;
      const elapsed = Date.now() - animation.startTime;
      const remainingTime = animation.duration - elapsed;
      
      // Adjust duration based on speed multiplier
      const newDuration = remainingTime / multiplier;
      animation.duration = elapsed + newDuration;
      
      console.log(`⚡ Speed adjusted for ${routeId}: ${multiplier}x`);
    }
  }

  // Reset all animations
  resetAllAnimations() {
    this.activeAnimations.clear();
    console.log('🔄 Reset all route animations');
  }
}

export default RouteProgressManager;
