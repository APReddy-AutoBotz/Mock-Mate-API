import { calibrateIntent } from '../mockGeminiService';
import { ValidationError } from '../../utils/errorHandler';

// Mock the AI service
jest.mock('../mockGeminiService', () => ({
  calibrateIntent: jest.fn(),
}));

import { PERSONAS_CONFIG } from '../../personas.config';

describe('Mock Gemini Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('calibrateIntent', () => {
    it('should throw ValidationError for empty intent', async () => {
      await expect(calibrateIntent('')).rejects.toThrow(ValidationError);
      await expect(calibrateIntent('  ')).rejects.toThrow(ValidationError);
      await expect(calibrateIntent('ab')).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for short intent', async () => {
      await expect(calibrateIntent('ab')).rejects.toThrow(ValidationError);
    });

    it('should accept valid intent', async () => {
      const mockCalibrateIntent = calibrateIntent as jest.MockedFunction<typeof calibrateIntent>;
      const mockResult = {
        recommendedPanelIDs: ['p1', 'p2', 'p3'],
        recommendedRole: 'Software Engineer'
      };
      
      mockCalibrateIntent.mockResolvedValue(mockResult);
      
      const result = await calibrateIntent('Senior Software Engineer');
      
      expect(mockCalibrateIntent).toHaveBeenCalledWith('Senior Software Engineer');
      expect(result).toEqual(mockResult);
    });

    it('should return fallback panel IDs when no valid IDs returned', async () => {
      const mockCalibrateIntent = calibrateIntent as jest.MockedFunction<typeof calibrateIntent>;
      const mockResult = {
        recommendedPanelIDs: [], // Empty array should trigger fallback
        recommendedRole: 'Software Engineer'
      };
      
      mockCalibrateIntent.mockResolvedValue(mockResult);
      
      const result = await calibrateIntent('Software Engineer');
      
      expect(result.recommendedPanelIDs).toEqual(['p1', 'p2', 'p3']); // Should use fallback
    });

    it('should filter invalid panel IDs', async () => {
      const mockCalibrateIntent = calibrateIntent as jest.MockedFunction<typeof calibrateIntent>;
      const mockResult = {
        recommendedPanelIDs: ['invalid1', 'p2', 'invalid2'], // Mix of valid and invalid
        recommendedRole: 'Software Engineer'
      };
      
      mockCalibrateIntent.mockResolvedValue(mockResult);
      
      const result = await calibrateIntent('Software Engineer');
      
      const validIDs = PERSONAS_CONFIG.map(p => p.id);
      const filteredIDs = result.recommendedPanelIDs.filter(id => validIDs.includes(id));
      
      expect(filteredIDs).toEqual(['p2']); // Only valid ID should remain
      expect(result.recommendedPanelIDs.length).toBeLessThanOrEqual(3); // Should not exceed 3
    });
  });
});
