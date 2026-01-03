import Joyride, { CallBackProps, STATUS, Step, ACTIONS, EVENTS } from 'react-joyride';
import { useTour } from '@/contexts/TourContext';

// Define the tour steps
const tourSteps: Step[] = [
    {
        target: 'body',
        content: (
            <div className="text-center">
                <h3 className="text-lg font-semibold mb-2">Welcome to QClaims! 🎉</h3>
                <p className="text-sm text-muted-foreground">
                    Let's take a quick tour to help you get started with managing your expense claims.
                </p>
            </div>
        ),
        placement: 'center',
        disableBeacon: true,
    },
    {
        target: '[data-tour="sidebar"]',
        content: (
            <div>
                <h4 className="font-semibold mb-2">Navigation Sidebar</h4>
                <p className="text-sm text-muted-foreground">
                    Use the sidebar to navigate between different sections like Dashboard, Claims, Reports, and more.
                </p>
            </div>
        ),
        placement: 'right',
    },
    {
        target: '[data-tour="new-claim"]',
        content: (
            <div>
                <h4 className="font-semibold mb-2">Create New Claim</h4>
                <p className="text-sm text-muted-foreground">
                    Click here to submit a new expense reimbursement or allowance claim. Our smart form makes it easy!
                </p>
            </div>
        ),
        placement: 'right',
    },
    {
        target: '[data-tour="dashboard-stats"]',
        content: (
            <div>
                <h4 className="font-semibold mb-2">Your Dashboard</h4>
                <p className="text-sm text-muted-foreground">
                    View your claim statistics, pending approvals, and recent activity at a glance.
                </p>
            </div>
        ),
        placement: 'bottom',
    },
    {
        target: '[data-tour="help-menu"]',
        content: (
            <div>
                <h4 className="font-semibold mb-2">Need Help?</h4>
                <p className="text-sm text-muted-foreground">
                    Click here anytime to rewatch this tour or access help resources.
                </p>
            </div>
        ),
        placement: 'bottom-end',
    },
];

export function ProductTour() {
    const { isTourOpen, markTourComplete, endTour } = useTour();

    const handleJoyrideCallback = (data: CallBackProps) => {
        const { status, action, type } = data;

        // Handle tour completion
        if (status === STATUS.FINISHED) {
            markTourComplete();
        }

        // Handle user skipping the tour
        if (status === STATUS.SKIPPED) {
            markTourComplete();
        }

        // Handle close button click
        if (action === ACTIONS.CLOSE && type === EVENTS.STEP_AFTER) {
            endTour();
        }
    };

    return (
        <Joyride
            steps={tourSteps}
            run={isTourOpen}
            continuous
            showProgress
            showSkipButton
            scrollToFirstStep
            disableOverlayClose
            callback={handleJoyrideCallback}
            styles={{
                options: {
                    primaryColor: 'hsl(var(--primary))',
                    textColor: 'hsl(var(--foreground))',
                    backgroundColor: 'hsl(var(--background))',
                    arrowColor: 'hsl(var(--background))',
                    overlayColor: 'rgba(0, 0, 0, 0.5)',
                    zIndex: 10000,
                },
                tooltip: {
                    borderRadius: '12px',
                    padding: '20px',
                    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.15)',
                },
                tooltipContainer: {
                    textAlign: 'left',
                },
                buttonNext: {
                    backgroundColor: 'hsl(var(--primary))',
                    borderRadius: '8px',
                    padding: '8px 16px',
                    fontSize: '14px',
                },
                buttonBack: {
                    marginRight: '8px',
                    color: 'hsl(var(--muted-foreground))',
                },
                buttonSkip: {
                    color: 'hsl(var(--muted-foreground))',
                },
            }}
            locale={{
                back: 'Back',
                close: 'Close',
                last: 'Finish',
                next: 'Next',
                skip: 'Skip Tour',
            }}
        />
    );
}
