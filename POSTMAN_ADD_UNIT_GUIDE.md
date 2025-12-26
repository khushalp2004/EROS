# 🚛 Postman Guide: Add Emergency Response Unit

## 📋 Quick Reference

### **Request Details**
- **Method:** `POST`
- **URL:** `http://localhost:5000/api/authority/units`
- **Headers:** `Content-Type: application/json`

---

## 🎯 Step-by-Step Instructions

### 1. **Open Postman**
   - Launch Postman application

### 2. **Create New Request**
   - Click "New Request" or "+"
   - Change method to `POST`

### 3. **Enter URL**
   ```
   http://localhost:5000/api/authority/units
   ```

### 4. **Set Headers**
   - Click "Headers" tab
   - Add header: `Content-Type: application/json`

### 5. **Set Body**
   - Click "Body" tab
   - Select "raw"
   - Select "JSON" from dropdown

### 6. **Paste JSON**
   Copy and paste one of the JSON examples below

---

## 📝 JSON Examples

### 🚑 **Add Ambulance**
```json
{
    "unit_vehicle_number": "AMB001",
    "service_type": "AMBULANCE",
    "latitude": 40.7128,
    "longitude": -74.0060
}
```

### 🚒 **Add Fire Truck**
```json
{
    "unit_vehicle_number": "FIRE001",
    "service_type": "FIRE_TRUCK",
    "latitude": 40.7589,
    "longitude": -73.9851
}
```

### 👮 **Add Police Unit**
```json
{
    "unit_vehicle_number": "POL001",
    "service_type": "POLICE",
    "latitude": 40.7831,
    "longitude": -73.9712
}
```

### 🚛 **Add Custom Unit**
```json
{
    "unit_vehicle_number": "UNIT001",
    "service_type": "AMBULANCE",
    "latitude": 40.7306,
    "longitude": -73.9352
}
```

---

## ✅ Expected Responses

### **Success (201 Created)**
```json
{
    "message": "Unit created successfully",
    "unit": {
        "unit_id": 1,
        "unit_vehicle_number": "AMB001",
        "service_type": "AMBULANCE",
        "latitude": 40.7128,
        "longitude": -74.006,
        "status": "AVAILABLE",
        "last_updated": "2024-01-15T10:30:00"
    }
}
```

### **Error Responses**

#### **400 - Missing Required Field**
```json
{
    "error": "Missing required field: unit_vehicle_number"
}
```

#### **409 - Vehicle Number Exists**
```json
{
    "error": "Vehicle number already exists"
}
```

#### **400 - Invalid Service Type**
```json
{
    "error": "Invalid service type. Must be one of: ['AMBULANCE', 'FIRE_TRUCK', 'POLICE']"
}
```

#### **400 - Invalid Coordinates**
```json
{
    "error": "Invalid coordinate values: could not convert string to float: 'invalid'"
}
```

---

## 🎯 **Required Fields**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `unit_vehicle_number` | String | ✅ Yes | Unique vehicle identifier (e.g., "AMB001") |
| `service_type` | String | ✅ Yes | Must be: "AMBULANCE", "FIRE_TRUCK", or "POLICE" |
| `latitude` | Number | ✅ Yes | GPS latitude coordinate |
| `longitude` | Number | ✅ Yes | GPS longitude coordinate |

---

## 📍 **Sample Coordinates**

### **New York City Area**
- Central Park: `40.7851, -73.9683`
- Times Square: `40.7580, -73.9855`
- Brooklyn Bridge: `40.7061, -73.9969`
- JFK Airport: `40.6413, -73.7781`

### **San Francisco Area**
- Golden Gate Bridge: `37.8199, -122.4783`
- Union Square: `37.7880, -122.4075`
- Fisherman's Wharf: `37.8080, -122.4177`

---

## 🔍 **Testing Tips**

### 1. **Test Different Coordinates**
- Try coordinates in different cities
- Test edge cases (very large/small numbers)

### 2. **Test Error Cases**
- Missing required fields
- Duplicate vehicle numbers
- Invalid service types
- Non-numeric coordinates

### 3. **Verify Status Changes**
- Check that `status` is always "AVAILABLE"
- Confirm `unit_id` is auto-generated
- Verify `last_updated` timestamp

### 4. **Validate Vehicle Numbers**
- Use format: `TYPE###` (e.g., "AMB001", "FIRE123")
- Ensure uniqueness across all units

---

## 🚀 **Quick Test Sequence**

1. **Add First Ambulance**
   ```json
   {
       "unit_vehicle_number": "AMB001",
       "service_type": "AMBULANCE", 
       "latitude": 40.7128,
       "longitude": -74.0060
   }
   ```

2. **Add Fire Truck**
   ```json
   {
       "unit_vehicle_number": "FIRE001",
       "service_type": "FIRE_TRUCK",
       "latitude": 40.7589, 
       "longitude": -73.9851
   }
   ```

3. **Add Police Unit**
   ```json
   {
       "unit_vehicle_number": "POL001",
       "service_type": "POLICE",
       "latitude": 40.7831,
       "longitude": -73.9712
   }
   ```

4. **Verify All Units**
   - GET `http://localhost:5000/api/authority/units`
   - Should return 3 units in response

---

## 📋 **Field Validation Rules**

### `unit_vehicle_number`
- Must be unique across all units
- Recommended format: `TYPE###` (e.g., "AMB001", "FIRE123")
- Maximum length: 20 characters
- No special characters required (but recommended)

### `service_type`
- Case insensitive (converted to uppercase internally)
- Valid values only: "AMBULANCE", "FIRE_TRUCK", "POLICE"
- Must be exact match (no abbreviations)

### `latitude`
- Must be numeric value
- Range: -90 to 90 degrees
- Decimal precision supported

### `longitude` 
- Must be numeric value
- Range: -180 to 180 degrees
- Decimal precision supported

---

## 🎯 **Success Indicators**

✅ **Request Successful When:**
- Status Code: `201 Created`
- Response contains `unit_id` (auto-generated)
- `status` field shows "AVAILABLE"
- `last_updated` has current timestamp
- `message` says "Unit created successfully"

❌ **Request Failed When:**
- Status Code: `400` (bad request)
- Status Code: `409` (conflict - duplicate)
- Status Code: `500` (server error)
- Response contains `error` field

---

## 🚀 **Ready to Test!**

Copy any JSON example above, paste it in Postman, and click "Send" to add your emergency response unit! 🚛
