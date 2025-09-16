// This file is deprecated - the Voting API now uses native MongoDB driver
// App data is accessed directly from the userapps collection via src/lib/mongodb.ts

export const Tool = {
  find: () => {
    throw new Error('Tool model deprecated. Use native MongoDB queries via connectToDatabase() from @/lib/mongodb instead.');
  },
  updateOne: () => {
    throw new Error('Tool model deprecated. Use native MongoDB queries via connectToDatabase() from @/lib/mongodb instead.');
  }
};
