/**
 * Signature capture component for verification workflow
 */

import React, { useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  PanResponder,
  Dimensions,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { theme } from '../styles/theme';

interface SignatureCanvasProps {
  onSave: (signature: string) => void;
  onClear?: () => void;
  strokeColor?: string;
  strokeWidth?: number;
  backgroundColor?: string;
  height?: number;
}

const SCREEN_WIDTH = Dimensions.get('window').width;

export const SignatureCanvas: React.FC<SignatureCanvasProps> = ({
  onSave,
  onClear,
  strokeColor = theme.colors.text.primary,
  strokeWidth = 3,
  backgroundColor = theme.colors.surface,
  height = 200,
}) => {
  const [paths, setPaths] = useState<string[]>([]);
  const [currentPath, setCurrentPath] = useState<string>('');
  const [currentPoints, setCurrentPoints] = useState<string>('');
  const [isSigning, setIsSigning] = useState(false);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        const newPath = `M${locationX.toFixed(2)},${locationY.toFixed(2)}`;
        setCurrentPath(newPath);
        setCurrentPoints(newPath);
        setIsSigning(true);
      },
      onPanResponderMove: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        const updatedPath = `${currentPoints} L${locationX.toFixed(2)},${locationY.toFixed(2)}`;
        setCurrentPath(updatedPath);
        setCurrentPoints(updatedPath);
      },
      onPanResponderRelease: () => {
        setPaths((prevPaths) => [...prevPaths, currentPath]);
        setCurrentPath('');
        setCurrentPoints('');
        setIsSigning(false);
      },
    })
  ).current;

  const handleClear = () => {
    setPaths([]);
    setCurrentPath('');
    setCurrentPoints('');
    onClear?.();
  };

  const handleSave = () => {
    if (paths.length === 0 && !currentPath) {
      return;
    }

    // Convert paths to base64 SVG
    const svgWidth = SCREEN_WIDTH - theme.spacing.lg * 2;
    const svgHeight = height;
    const allPaths = [...paths, currentPath].filter(Boolean);
    
    const svgContent = `
      <svg width="${svgWidth}" height="${svgHeight}" xmlns="http://www.w3.org/2000/svg">
        ${allPaths.map(path => 
          `<path d="${path}" stroke="${strokeColor}" stroke-width="${strokeWidth}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
        ).join('')}
      </svg>
    `;

    // In React Native, we'll pass the SVG paths directly
    // In a real app, you'd convert this to an image using react-native-svg
    const signatureData = JSON.stringify({
      paths: allPaths,
      width: svgWidth,
      height: svgHeight,
    });
    
    onSave(signatureData);
  };

  const isEmpty = paths.length === 0 && !currentPath;

  return (
    <View style={styles.container}>
      <View 
        style={[styles.canvas, { backgroundColor, height }]}
        {...panResponder.panHandlers}
      >
        <Svg height={height} width="100%">
          {paths.map((path, index) => (
            <Path
              key={index}
              d={path}
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          {currentPath !== '' && (
            <Path
              d={currentPath}
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
        </Svg>
        
        {isEmpty && !isSigning && (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderText}>Sign here</Text>
          </View>
        )}
      </View>
      
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, styles.clearButton]}
          onPress={handleClear}
          disabled={isEmpty}
        >
          <Text style={[styles.buttonText, styles.clearButtonText]}>Clear</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.button, styles.saveButton, isEmpty && styles.disabledButton]}
          onPress={handleSave}
          disabled={isEmpty}
        >
          <Text style={[styles.buttonText, styles.saveButtonText]}>Save Signature</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  canvas: {
    width: '100%',
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border.light,
    overflow: 'hidden',
    position: 'relative',
  },
  placeholder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: theme.typography.fontSize.lg,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.text.disabled,
  },
  buttonContainer: {
    flexDirection: 'row',
    marginTop: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  button: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  clearButton: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border.medium,
  },
  saveButton: {
    backgroundColor: theme.colors.primary,
  },
  disabledButton: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontFamily.medium,
  },
  clearButtonText: {
    color: theme.colors.text.primary,
  },
  saveButtonText: {
    color: theme.colors.accent,
  },
});