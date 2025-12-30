import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import api from '../api';
import ProgressIndicator from './ProgressIndicator';
import EmergencyTypeStep from './steps/EmergencyTypeStep';
import LocationStep from './steps/LocationStep';
import ConfirmationStep from './steps/ConfirmationStep';
import SuccessStep from './steps/SuccessStep';

const STEPS = [
  {
    id: 'type',
    title: 'Emergency Type',
    description: 'What type of emergency are you reporting?'
  },
  {
    id: 'location',
    title: 'Location',
    description: 'Where is the emergency located?'
  },
  {
    id: 'confirmation',
    title: 'Review & Submit',
    description: 'Please review your information before submitting'
  },
  {
    id: 'success',
    title: 'Success',
    description: 'Your emergency has been reported'
  }
];

function MultiStepEmergencyReport() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({
    emergencyType: '',
    severity: 'medium',
    location: null,
    description: '',
    contactInfo: {
      name: user?.full_name || '',
      phone: user?.phone || '',
      email: user?.email || ''
    }
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});

  const updateFormData = (updates) => {
    setFormData(prev => ({
      ...prev,
      ...updates
    }));
    
    // Clear validation errors when data is updated
    if (validationErrors) {
      setValidationErrors({});
    }
  };

  const validateCurrentStep = async () => {
    setIsValidating(true);
    const errors = {};

    switch (currentStep) {
      case 0: // Emergency Type
        if (!formData.emergencyType) {
          errors.emergencyType = 'Please select an emergency type';
        }
        break;
      
      case 1: // Location
        if (!formData.location) {
          errors.location = 'Please select a location';
        }
        break;
      
      case 2: // Confirmation
        // All data should be validated at this point
        if (!formData.emergencyType || !formData.location) {
          errors.general = 'Please complete all required fields';
        }
        break;
      
      default:
        break;
    }

    setValidationErrors(errors);
    setIsValidating(false);
    
    return Object.keys(errors).length === 0;
  };

  const handleNext = async () => {
    const isValid = await validateCurrentStep();
    if (isValid && currentStep < STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    
    try {
      const [lat, lng] = formData.location;
      const response = await api.post('/api/emergencies', {
        emergency_type: formData.emergencyType,
        latitude: lat,
        longitude: lng,
        severity: formData.severity,
        description: formData.description || null
      });

      console.log('Emergency submitted successfully:', response.data);
      
      // Move to success step
      setCurrentStep(3);
      
      // Show success notification based on user role
      if (!user || user.role === 'reporter') {
        // Show popup for reporter users - handled by SuccessStep
      } else {
        // Show success toast for admin/authority users
        if (window.showSuccessToast) {
          window.showSuccessToast("Emergency reported successfully!", {
            description: "Our emergency response team has been notified and will respond promptly."
          });
        }
      }
      
    } catch (err) {
      console.error('Error submitting emergency:', err);
      
      // Show error notification
      if (window.showErrorToast) {
        window.showErrorToast("Failed to report emergency", {
          description: "Please check your connection and try again."
        });
      }
      
      // Stay on current step to allow retry
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <EmergencyTypeStep
            data={formData}
            onUpdate={updateFormData}
            errors={validationErrors}
          />
        );
      
      case 1:
        return (
          <LocationStep
            data={formData}
            onUpdate={updateFormData}
            errors={validationErrors}
          />
        );
      
      case 2:
        return (
          <ConfirmationStep
            data={formData}
            onUpdate={updateFormData}
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting}
            errors={validationErrors}
          />
        );
      
      case 3:
        return (
          <SuccessStep
            data={formData}
            onStartNew={() => {
              setCurrentStep(0);
              setFormData({
                emergencyType: '',
                severity: 'medium',
                location: null,
                description: '',
                contactInfo: {
                  name: user?.full_name || '',
                  phone: user?.phone || '',
                  email: user?.email || ''
                }
              });
            }}
            onClose={() => navigate('/')}
          />
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="multi-step-emergency-report">
      <div className="container">
        {/* Page Header */}
        <div className="page-header">
          <div className="container">
            <h1 className="page-title">
              🚨 Report Emergency
            </h1>
            <p className="page-subtitle">
              Follow the simple steps below to report your emergency and get immediate assistance
            </p>
          </div>
        </div>

        {/* Progress Indicator */}
        {currentStep < 3 && (
          <div className="progress-section">
            <ProgressIndicator
              currentStep={currentStep}
              totalSteps={STEPS.length - 1}
              steps={STEPS}
            />
          </div>
        )}

        {/* Step Content */}
        <div className="step-content">
          {renderCurrentStep()}
        </div>

        {/* Navigation Buttons */}
        {currentStep < 3 && (
          <div className="step-navigation">
            <div className="container">
              <div className="nav-buttons">
                {currentStep > 0 && (
                  <button
                    onClick={handleBack}
                    className="btn btn-outline"
                    disabled={isSubmitting || isValidating}
                  >
                    ← Back
                  </button>
                )}
                
                <div className="nav-spacer" />
                
                <button
                  onClick={handleNext}
                  disabled={isSubmitting || isValidating}
                  className={`btn btn-primary ${isValidating ? 'btn-loading' : ''}`}
                  style={{
                    background: currentStep === 2 ? 
                      'linear-gradient(135deg, var(--accent-red), var(--accent-red-light))' : 
                      undefined
                  }}
                >
                  {isValidating ? (
                    <>
                      <div className="spinner"></div>
                      Validating...
                    </>
                  ) : currentStep === 2 ? (
                    <>
                      🚨 Submit Emergency Report
                    </>
                  ) : (
                    'Continue →'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default MultiStepEmergencyReport;
