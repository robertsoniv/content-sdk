import React, { forwardRef, JSX } from 'react';
import {
  Image as ReactImage,
  ImageFieldValue,
  ImageField,
  ImageProps as ReactImageProps,
} from '@sitecore-content-sdk/react';

export type TanstackImageProps = ReactImageProps & {
  /**
   * Loading behavior for the image
   * @default 'lazy'
   */
  loading?: 'lazy' | 'eager';
  /**
   * Decoding behavior for the image
   * @default 'async'
   */
  decoding?: 'async' | 'sync' | 'auto';
};

export const TanstackImage = forwardRef<HTMLImageElement, TanstackImageProps>(
  (props: TanstackImageProps, ref): JSX.Element | null => {
    const {
      field,
      editable = true,
      loading = 'lazy',
      decoding = 'async',
      ...htmlImageProps
    } = props;

    if (!field || (!field.value && !(field as ImageFieldValue).src && !field.metadata)) {
      return null;
    }

    const value = (
      (field as ImageFieldValue).src ? field : (field as ImageField).value
    ) as ImageFieldValue;

    const isEditing = editable && (field as ImageFieldValue).metadata;

    if (value && !isEditing) {
      const { src, alt, width, height, srcSet, ...imageProps } = value;

      // Convert srcSet to string if it's an array
      const srcSetString = (() => {
        if (Array.isArray(srcSet)) {
          return srcSet.join(', ');
        }
        if (typeof srcSet === 'string') {
          return srcSet;
        }
        return undefined;
      })();

      return (
        <img
          src={src}
          alt={(alt as string) || ''}
          width={width as string | number | undefined}
          height={height as string | number | undefined}
          srcSet={srcSetString as any}
          loading={loading}
          decoding={decoding}
          {...imageProps}
          {...htmlImageProps}
          ref={ref}
          {...(process.env.TEST ? { 'data-tanstack-image': true } : {})}
        />
      );
    }

    // For editing mode, use the React component
    return (
      <ReactImage
        {...props}
        ref={ref}
        {...(process.env.TEST ? { 'data-react-image': true } : {})}
      />
    );
  }
);

TanstackImage.displayName = 'TanstackImage';
