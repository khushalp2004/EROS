/**
 * DataValidationUtils.js
 * Utility functions for safe object property access and type validation
 * Fixes "Unit object has no attribute 'assigned_unit'" errors
 */

/**
 * Check if object is an Emergency
 * @param {Object} obj - Object to check
 * @returns {boolean} True if object is an Emergency
 */
export const isEmergency = (obj) => {
  return obj && typeof obj === 'object' && 
         (obj.request_id !== undefined || obj.emergency_type !== undefined) &&
         obj.assigned_unit !== undefined;
};

/**
 * Check if object is a Unit
 * @param {Object} obj - Object to check
 * @returns {boolean} True if object is a Unit
 */
export const isUnit = (obj) => {
  return obj && typeof obj === 'object' && 
         obj.unit_id !== undefined && 
         obj.service_type !== undefined &&
         obj.assigned_unit === undefined; // Units don't have assigned_unit
};

/**
 * Safely get assigned unit from Emergency object
 * @param {Object} emergencyOrUnit - Emergency or Unit object
 * @returns {number|null} Assigned unit ID or null
 */
export const getAssignedUnit = (emergencyOrUnit) => {
  if (!emergencyOrUnit || typeof emergencyOrUnit !== 'object') {
    return null;
  }
  
  // If it's an Emergency with assigned_unit property
  if (emergencyOrUnit.assigned_unit !== undefined) {
    return emergencyOrUnit.assigned_unit;
  }
  
  // If it's a Unit, it doesn't have assigned_unit - this might be the source of the error
  if (isUnit(emergencyOrUnit)) {
    console.warn('⚠️ getAssignedUnit called on Unit object (Units don\'t have assigned_unit):', emergencyOrUnit);
    return null;
  }
  
  // Unknown object type
  console.warn('⚠️ getAssignedUnit called on unknown object type:', emergencyOrUnit);
  return null;
};

/**
 * Safely get unit ID from Unit object
 * @param {Object} unit - Unit object
 * @returns {number|null} Unit ID or null
 */
export const getUnitId = (unit) => {
  if (!unit || typeof unit !== 'object') {
    return null;
  }
  
  if (unit.unit_id !== undefined) {
    return unit.unit_id;
  }
  
  console.warn('⚠️ getUnitId called on object without unit_id:', unit);
  return null;
};

/**
 * Safe property getter with fallback
 * @param {Object} obj - Object to get property from
 * @param {string} prop - Property name
 * @param {*} fallback - Fallback value if property doesn't exist
 * @returns {*} Property value or fallback
 */
export const safeGet = (obj, prop, fallback = null) => {
  if (!obj || typeof obj !== 'object' || !(prop in obj)) {
    return fallback;
  }
  return obj[prop];
};

/**
 * Validate Emergency object structure
 * @param {Object} emergency - Object to validate
 * @returns {Object} Validation result with isValid and errors
 */
export const validateEmergency = (emergency) => {
  const errors = [];
  
  if (!emergency) {
    errors.push('Emergency is null/undefined');
    return { isValid: false, errors };
  }
  
  if (typeof emergency !== 'object') {
    errors.push('Emergency is not an object');
    return { isValid: false, errors };
  }
  
  if (emergency.request_id === undefined) {
    errors.push('Missing request_id');
  }
  
  if (emergency.emergency_type === undefined) {
    errors.push('Missing emergency_type');
  }
  
  // assigned_unit is optional for non-assigned emergencies
  if (emergency.status === 'ASSIGNED' && emergency.assigned_unit === undefined) {
    errors.push('Missing assigned_unit for ASSIGNED emergency');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Validate Unit object structure
 * @param {Object} unit - Object to validate
 * @returns {Object} Validation result with isValid and errors
 */
export const validateUnit = (unit) => {
  const errors = [];
  
  if (!unit) {
    errors.push('Unit is null/undefined');
    return { isValid: false, errors };
  }
  
  if (typeof unit !== 'object') {
    errors.push('Unit is not an object');
    return { isValid: false, errors };
  }
  
  if (unit.unit_id === undefined) {
    errors.push('Missing unit_id');
  }
  
  if (unit.service_type === undefined) {
    errors.push('Missing service_type');
  }
  
  // Units should NOT have assigned_unit - this would indicate a data error
  if (unit.assigned_unit !== undefined) {
    errors.push('Unit object should not have assigned_unit property');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Find unit by assigned unit ID from emergencies
 * @param {Array} units - Array of Unit objects
 * @param {Array} emergencies - Array of Emergency objects  
 * @param {number} unitId - Unit ID to search for
 * @returns {Object|null} Found unit or null
 */
export const findAssignedUnit = (units, emergencies, unitId) => {
  if (!units || !Array.isArray(units) || !emergencies || !Array.isArray(emergencies)) {
    return null;
  }
  
  // Find emergency that has this unit assigned
  const assignedEmergency = emergencies.find(e => 
    e.status === 'ASSIGNED' && getAssignedUnit(e) === unitId
  );
  
  if (!assignedEmergency) {
    return null;
  }
  
  // Return the unit that matches the unitId
  return units.find(u => getUnitId(u) === unitId) || null;
};

/**
 * Enhanced error logging for debugging
 * @param {string} context - Context where error occurred
 * @param {Object} obj - Object that caused the error
 * @param {string} operation - Operation being performed
 */
export const logDataError = (context, obj, operation = 'access property') => {
  console.error(`❌ Data Error in ${context}:`, {
    operation,
    objectType: obj ? obj.constructor?.name || typeof obj : 'undefined',
    objectKeys: obj ? Object.keys(obj) : [],
    objectPreview: obj ? { 
      unit_id: safeGet(obj, 'unit_id'), 
      request_id: safeGet(obj, 'request_id'),
      assigned_unit: safeGet(obj, 'assigned_unit'),
      service_type: safeGet(obj, 'service_type'),
      emergency_type: safeGet(obj, 'emergency_type')
    } : null
  });
};

export default {
  isEmergency,
  isUnit,
  getAssignedUnit,
  getUnitId,
  safeGet,
  validateEmergency,
  validateUnit,
  findAssignedUnit,
  logDataError
};
