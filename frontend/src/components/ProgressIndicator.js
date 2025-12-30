import React from 'react';

function ProgressIndicator({ currentStep, totalSteps, steps }) {
  const progressPercentage = ((currentStep + 1) / totalSteps) * 100;

  return (
    <div className="progress-indicator-container">
      <div className="progress-steps">
        {steps.map((step, index) => (
          <div
            key={index}
            className={`progress-step ${
              index < currentStep ? 'completed' : 
              index === currentStep ? 'current' : 
              'upcoming'
            }`}
          >
            <div className="progress-step-number">
              {index < currentStep ? '✓' : index + 1}
            </div>
            <div className="progress-step-content">
              <div className="progress-step-title">{step.title}</div>
              <div className="progress-step-description">{step.description}</div>
            </div>
          </div>
        ))}
      </div>
      
      <div className="progress-bar">
        <div 
          className="progress-bar-fill"
          style={{ width: `${progressPercentage}%` }}
        />
      </div>
      
      <div className="progress-text">
        Step {currentStep + 1} of {totalSteps}
      </div>
    </div>
  );
}

export default ProgressIndicator;
