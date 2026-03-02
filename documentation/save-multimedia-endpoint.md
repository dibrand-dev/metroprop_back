# Save Multimedia Endpoint

## Overview
Professional endpoint for handling mixed multimedia content for properties, supporting both external URLs and file uploads in a single atomic operation.

## Endpoint
```
POST /properties/:propertyId/save-multimedia
Content-Type: multipart/form-data
```

## Use Cases
This endpoint handles 4 types of multimedia content:

1. **External Video URLs** (YouTube, Vimeo, etc.)
2. **360° Virtual Tour URLs** 
3. **Image Files** (uploaded binary files)
4. **Document Attachments** (PDFs, docs, etc.)

## Request Format

### Form Data Structure
```typescript
{
  // JSON strings in form fields
  videos?: string,          // JSON array of {url, order} 
  multimedia360?: string,   // JSON array of {url, order}
  images?: string,         // JSON array of {order_position} (optional)
  attached?: string,       // JSON array of {order, description} (optional)
  
  // Binary files
  images: File[],          // Image files (jpg, png, etc.)
  attached: File[]         // Any type of files (pdf, doc, etc.)
}
```

### Example JavaScript Implementation

#### Complete Example (All content types):
```javascript
const formData = new FormData();

// External video URLs
formData.append('videos', JSON.stringify([
  { url: 'https://www.youtube.com/watch?v=video1', order: 1 },
  { url: 'https://www.youtube.com/watch?v=video2', order: 2 }
]));

// 360° Virtual tours
formData.append('multimedia360', JSON.stringify([
  { url: 'https://my360tour.com/tour1', order: 1 },
  { url: 'https://my360tour.com/tour2', order: 2 }
]));

// Image metadata (optional - auto-generated if omitted)
formData.append('images', JSON.stringify([
  { order_position: 1 },
  { order_position: 2 }
]));

// Attachment metadata (optional - auto-generated if omitted) 
formData.append('attached', JSON.stringify([
  { order: 1, description: 'Floor plans' },
  { order: 2, description: 'Property manual' }
]));

// Image files
imageFiles.forEach(file => formData.append('images', file));

// Document files
documentFiles.forEach(file => formData.append('attached', file));

// Send request
const response = await fetch('/properties/32/save-multimedia', {
  method: 'POST',
  body: formData
});
```

#### Simplified Examples:

**Only Video URLs:**
```javascript
const formData = new FormData();
formData.append('videos', JSON.stringify([
  { url: 'https://www.youtube.com/watch?v=abc123', order: 1 }
]));
```

**Only Image Files (no metadata):**
```javascript
const formData = new FormData();
imageFiles.forEach(file => formData.append('images', file));
// Order will be auto-generated: 1, 2, 3...
```

**Mixed Content:**
```javascript
const formData = new FormData();

// Some videos
formData.append('videos', JSON.stringify([
  { url: 'https://youtube.com/watch?v=xyz', order: 1 }
]));

// Some files without metadata
fileList.forEach(file => formData.append('attached', file));
```

## Response Format

### Success Response:
```json
{
  "message": "Multimedia guardado correctamente. Los archivos se están procesando en segundo plano.",
  "summary": {
    "processed": 2,  // Videos/360 URLs processed immediately
    "queued": 5,     // Files queued for background upload
    "errors": 0
  },
  "details": {
    "videos": { "processed": 2, "errors": 0 },
    "multimedia360": { "processed": 0, "errors": 0 },
    "images": { "queued": 3, "errors": 0 },
    "attached": { "queued": 2, "errors": 0 }
  },
  "uploadTrackingEnabled": true
}
```

### Error Response:
```json
{
  "statusCode": 400,
  "message": "Invalid JSON format in field 'videos': Unexpected token",
  "error": "Bad Request"
}
```

## Features

### 🔄 **Atomic Operations**
- All operations wrapped in database transaction
- Rollback on any error ensures data consistency  
- Previous multimedia content is replaced entirely

### 📊 **Smart Metadata Handling**
- **With Metadata**: Use provided order/descriptions
- **Without Metadata**: Auto-generate sequential values
- **Flexible**: Mix metadata and auto-generation

### 🚀 **Background Processing**
- URLs processed immediately (synchronous)
- File uploads processed in background (asynchronous) 
- Track upload progress with `/upload-status` endpoint

### ✅ **Robust Validation**
- URL validation for external links
- File type validation
- Metadata consistency checks
- Comprehensive error messages

### 🔍 **Professional Logging**
- Structured logging with context
- Operation summaries and detailed breakdowns
- Performance and error tracking

## Best Practices

### 1. **Always Send Both Files and Metadata**
```javascript
// ✅ GOOD: Provides ordering control
formData.append('images', JSON.stringify([
  { order_position: 1 },
  { order_position: 2 }
]));
imageFiles.forEach(file => formData.append('images', file));

// ⚠️ OKAY: Auto-generates sequential order
imageFiles.forEach(file => formData.append('images', file));
```

### 2. **Validate JSON Before Sending**
```javascript
// ✅ GOOD: Validate structure
const videos = [{ url: 'https://youtube.com/watch?v=abc', order: 1 }];
if (videos.every(v => v.url && v.order)) {
  formData.append('videos', JSON.stringify(videos));
}
```

### 3. **Handle File Types Appropriately**
```javascript
// ✅ GOOD: Separate by purpose
images.forEach(file => formData.append('images', file));      // Visual content
docs.forEach(file => formData.append('attached', file));     // Documents
```

### 4. **Monitor Upload Progress**
```javascript
// After successful submission
const statusResponse = await fetch(`/properties/${propertyId}/upload-status`);
const uploadStatus = await statusResponse.json();
```

## Error Handling

### Common Errors:
- **Invalid JSON**: Malformed JSON in form fields
- **File Count Mismatch**: Different number of files vs metadata entries
- **URL Validation**: Invalid video/tour URLs
- **Property Not Found**: Invalid propertyId

### Error Recovery:
- **Retry Failed Uploads**: `POST /properties/:id/retry-uploads`
- **Check Upload Status**: `GET /properties/:id/upload-status`

## Architecture

### Request Flow:
1. **Interceptor** auto-parses JSON form fields
2. **Controller** validates DTO structure  
3. **Service** processes in database transaction:
   - Delete existing multimedia
   - Save URLs immediately  
   - Queue files for background upload
4. **Background Workers** handle file uploads
5. **Status Tracking** monitors upload progress

### Scalability Features:
- Non-blocking file uploads
- Retry mechanisms for failed uploads
- Circuit breaker for external services
- Comprehensive monitoring and logging