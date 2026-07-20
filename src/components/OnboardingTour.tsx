import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ArrowRight, ArrowLeft, Sparkles, Check, HelpCircle } from 'lucide-react';
import { Member } from '../types';

interface OnboardingTourProps {
  user: Member;
  onComplete: () => void;
}

interface TourStep {
  title: string;
  description: string;
  targetId?: string;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  icon: string;
  badgeText?: string;
}

export function OnboardingTour({ user, onComplete }: OnboardingTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null);
  const [windowSize, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  const cardRef = useRef<HTMLDivElement>(null);

  const steps: TourStep[] = [
    {
      title: `Welcome to Shalom Youth, ${user.name}! 🌟`,
      description: "We are thrilled to have you join our digital fellowship! Let's take a quick 1-minute tour of your console features.",
      icon: "👋",
      badgeText: "Welcome",
      position: "center"
    },
    {
      title: "Your Profile and Identity 👤",
      description: "Click 'Edit Profile' to customize your account details: select your phone, address, gender, and birthday. Keeping your details updated lets us know you better and celebrate milestones together!",
      targetId: "tour-edit-profile-btn",
      position: "bottom",
      icon: "👤",
      badgeText: "Step 1 of 3"
    },
    {
      title: "Real-time Global Chat 💬",
      description: "Share Bible verses, friendly greetings, or quick announcements with everyone in the Shalom Youth fellowship. Your chat window is always available at the bottom-right corner!",
      targetId: "tour-global-chat-btn",
      position: "top",
      icon: "💬",
      badgeText: "Step 2 of 3"
    },
    {
      title: "Birthday Gift Box 💝",
      description: "When your birthday arrives, a special floating Birthday Gift Box will appear at the bottom-left! Other members can send you direct birthday blessings, and you can open them to celebrate.",
      targetId: "tour-gift-box-btn",
      position: "top",
      icon: "🎁",
      badgeText: "Step 3 of 3"
    },
    {
      title: "All Set! Ready to Explore ✨",
      description: "You're ready to make the most of the Shalom Youth Members Console. Start customizing your profile or join the live fellowship in the global chat!",
      icon: "🚀",
      badgeText: "Complete",
      position: "center"
    }
  ];

  // Update window size & recalculate highlight rect
  useEffect(() => {
    const handleResize = () => {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleResize);
    };
  }, []);

  // Recalculate spotlight whenever currentStep or window size changes
  useEffect(() => {
    const step = steps[currentStep];
    if (step && step.targetId) {
      const element = document.getElementById(step.targetId);
      if (element) {
        // Ensure element is visible or scrolled into view if off-screen
        element.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        
        // Timeout to allow scroll animation to settle before fetching bounding box
        const timer = setTimeout(() => {
          const rect = element.getBoundingClientRect();
          setHighlightRect(rect);
        }, 150);
        return () => clearTimeout(timer);
      } else {
        setHighlightRect(null);
      }
    } else {
      setHighlightRect(null);
    }
  }, [currentStep, windowSize]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleFinish();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleFinish = () => {
    localStorage.setItem('sy_onboarding_tour_v1', 'completed');
    onComplete();
  };

  const activeStep = steps[currentStep];

  // Tooltip dynamic positioning calculation helper with strict boundary checking and flipping
  const isCentered = !highlightRect || activeStep.position === 'center' || window.innerWidth < 768;

  const getTooltipPositionStyle = () => {
    const margin = 16;
    const cardWidth = 320;
    const cardHeight = 240; // Safe estimate for card height

    if (isCentered) {
      return {};
    }

    const targetCenterX = highlightRect.left + highlightRect.width / 2;
    const targetCenterY = highlightRect.top + highlightRect.height / 2;

    let computedTop = 0;
    let computedLeft = 0;

    switch (activeStep.position) {
      case 'bottom':
        computedTop = highlightRect.bottom + margin;
        computedLeft = targetCenterX - cardWidth / 2;
        // Flip to top if it exceeds the viewport height
        if (computedTop + cardHeight > window.innerHeight - margin) {
          computedTop = highlightRect.top - cardHeight - margin;
        }
        break;
      case 'top':
        computedTop = highlightRect.top - cardHeight - margin;
        computedLeft = targetCenterX - cardWidth / 2;
        // Flip to bottom if it goes off the top edge
        if (computedTop < margin) {
          computedTop = highlightRect.bottom + margin;
        }
        break;
      case 'left':
        computedTop = targetCenterY - cardHeight / 2;
        computedLeft = highlightRect.left - cardWidth - margin;
        // Flip to right if it goes off the left edge
        if (computedLeft < margin) {
          computedLeft = highlightRect.right + margin;
        }
        break;
      case 'right':
        computedTop = targetCenterY - cardHeight / 2;
        computedLeft = highlightRect.right + margin;
        // Flip to left if it goes off the right edge
        if (computedLeft + cardWidth > window.innerWidth - margin) {
          computedLeft = highlightRect.left - cardWidth - margin;
        }
        break;
      default:
        return {};
    }

    // Safety fallback clamp to guarantee it never extends outside the viewport boundaries
    computedTop = Math.max(margin, Math.min(window.innerHeight - cardHeight - margin, computedTop));
    computedLeft = Math.max(margin, Math.min(window.innerWidth - cardWidth - margin, computedLeft));

    return {
      top: `${computedTop}px`,
      left: `${computedLeft}px`,
      position: 'fixed' as const,
      width: `${cardWidth}px`,
    };
  };

  const tooltipStyle = getTooltipPositionStyle();

  const renderCardContent = () => (
    <>
      {/* Accent Header Ribbon */}
      <div className="h-1.5 bg-gradient-to-r from-emerald-500 via-indigo-500 to-violet-500 shrink-0"></div>

      {/* Card Main Body */}
      <div className="p-5 flex-1 overflow-y-auto space-y-4">
        {/* Header row */}
        <div className="flex items-center justify-between">
          {activeStep.badgeText && (
            <span className="text-[10px] font-extrabold uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 px-2.5 py-1 rounded-full border border-emerald-100 dark:border-emerald-900/30">
              {activeStep.badgeText}
            </span>
          )}
          <button
            onClick={handleFinish}
            className="text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition-colors p-1 bg-stone-50 hover:bg-stone-100 dark:bg-stone-800 dark:hover:bg-stone-750 rounded-full cursor-pointer ml-auto"
            title="Skip onboarding tour"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Title & Icon */}
        <div className="flex items-start gap-3">
          <span className="text-3xl shrink-0 select-none animate-pulse">
            {activeStep.icon}
          </span>
          <div className="space-y-1">
            <h4 className="text-sm font-extrabold text-stone-900 dark:text-white tracking-tight leading-snug">
              {activeStep.title}
            </h4>
            <p className="text-xs text-stone-500 dark:text-stone-400 font-semibold leading-relaxed">
              {activeStep.description}
            </p>
          </div>
        </div>

        {/* Visual Indicator of Spotlight Element (if offscreen/mobile/hidden) */}
        {activeStep.targetId && !highlightRect && (
          <div className="bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 rounded-xl p-2.5 text-[10px] text-amber-700 dark:text-amber-400 flex items-start gap-1.5 font-bold">
            <HelpCircle className="w-3.5 h-3.5 shrink-0 text-amber-500" />
            <span>Note: This feature is floating on your desktop viewport, or accessible in your current panel.</span>
          </div>
        )}
      </div>

      {/* Footer Controls */}
      <div className="px-5 py-3.5 bg-stone-50 dark:bg-stone-950/40 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between gap-3 shrink-0">
        {/* Dots */}
        <div className="flex items-center gap-1.5">
          {steps.map((_, idx) => (
            <div
              key={idx}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                idx === currentStep
                  ? 'w-4 bg-emerald-500 dark:bg-emerald-400'
                  : 'w-1.5 bg-stone-200 dark:bg-stone-700'
              }`}
            />
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {currentStep > 0 && (
            <button
              onClick={handlePrev}
              className="px-3 py-1.5 text-xs text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200 hover:bg-stone-150 dark:hover:bg-stone-800/60 rounded-xl transition-colors cursor-pointer font-bold flex items-center gap-1"
            >
              <ArrowLeft className="w-3 h-3" />
              Back
            </button>
          )}

          <button
            onClick={handleNext}
            className="px-4 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl shadow-md shadow-emerald-600/10 hover:shadow-emerald-600/20 transition-all font-black flex items-center gap-1 cursor-pointer"
          >
            {currentStep === steps.length - 1 ? (
              <>
                Explore
                <Check className="w-3 h-3" />
              </>
            ) : (
              <>
                Next
                <ArrowRight className="w-3 h-3" />
              </>
            )}
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="fixed inset-0 z-50 overflow-hidden pointer-events-auto">
      {/* SVG Spotlight Mask Backdrop Overlay */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        <defs>
          <mask id="onboarding-spotlight-mask">
            {/* White color permits background mask rendering */}
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {/* Black cut-out reveals underlying content */}
            {highlightRect && (
              <rect
                x={highlightRect.left - 8}
                y={highlightRect.top - 8}
                width={highlightRect.width + 16}
                height={highlightRect.height + 16}
                rx="12"
                fill="black"
                className="transition-all duration-300"
              />
            )}
          </mask>
        </defs>
        {/* Semi-transparent dark overlay */}
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(12, 10, 9, 0.65)"
          mask="url(#onboarding-spotlight-mask)"
          className="transition-all duration-300"
        />
      </svg>

      {/* Actual Click Blocker for Spotlight Area, but allows clicks inside spotlight if we wanted to */}
      <div className="absolute inset-0 bg-transparent pointer-events-auto" />

      {/* Floating Animated Card Dialog */}
      {isCentered ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-transparent pointer-events-none">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              ref={cardRef}
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -15 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="w-[92vw] max-w-[330px] max-h-[85vh] bg-white dark:bg-stone-900 rounded-3xl shadow-2xl border border-stone-200 dark:border-stone-800 pointer-events-auto flex flex-col overflow-hidden"
              id="tour-card-dialog"
            >
              {renderCardContent()}
            </motion.div>
          </AnimatePresence>
        </div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            ref={cardRef}
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            style={tooltipStyle}
            className="max-h-[85vh] bg-white dark:bg-stone-900 rounded-3xl shadow-2xl border border-stone-200 dark:border-stone-800 pointer-events-auto flex flex-col z-50 overflow-hidden"
            id="tour-card-dialog"
          >
            {renderCardContent()}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}
