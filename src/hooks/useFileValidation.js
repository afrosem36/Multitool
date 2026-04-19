import { useCallback } from 'react';

export const useFileValidation = () => {
  const validateFiles = useCallback((files, options = {}) => {
    const {
      maxSizeMB = 20, // Default 20MB
      allowedTypes = ['application/pdf'],
      maxFiles = 10,
      currentCount = 0
    } = options;

    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    const validFiles = [];
    let error = null;

    if (files.length + currentCount > maxFiles) {
      error = `You can only upload up to ${maxFiles} files at once.`;
      return { validFiles, error };
    }

    const filesArray = Array.from(files);

    for (let i = 0; i < filesArray.length; i++) {
      const file = filesArray[i];

      if (!allowedTypes.includes(file.type) && allowedTypes.length > 0 && !allowedTypes.includes('*')) {
        // Simple type checking, might need more robust checks for some types
        error = `Invalid file type for ${file.name}. Allowed: ${allowedTypes.join(', ')}.`;
        continue;
      }

      if (file.size > maxSizeBytes) {
        error = `File ${file.name} is too large. Max size is ${maxSizeMB}MB.`;
        continue;
      }

      validFiles.push(file);
    }

    return { validFiles, error };
  }, []);

  return { validateFiles };
};
