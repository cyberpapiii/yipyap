import React, { useState, useRef, useEffect } from 'react';

/**
 * Lazy loading image component with intersection observer
 * Optimizes performance by loading images only when they're visible
 */
const LazyImage = ({
  src,
  alt = '',
  className = '',
  placeholder = '/images/placeholder.svg',
  width,
  height,
  onLoad,
  onError,
  ...props
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.unobserve(entry.target);
          }
        });
      },
      {
        rootMargin: '50px', // Load images 50px before they're visible
        threshold: 0.1,
      }
    );

    const currentImg = imgRef.current;
    if (currentImg) {
      observer.observe(currentImg);
    }

    return () => {
      if (currentImg) {
        observer.unobserve(currentImg);
      }
    };
  }, []);

  const handleLoad = (e) => {
    setIsLoaded(true);
    if (onLoad) onLoad(e);
  };

  const handleError = (e) => {
    setHasError(true);
    if (onError) onError(e);
  };

  // Generate srcSet for responsive images
  const generateSrcSet = (baseSrc) => {
    if (!baseSrc) return '';

    const extension = baseSrc.split('.').pop();
    const baseName = baseSrc.replace(`.${extension}`, '');

    return [
      `${baseName}_320w.${extension} 320w`,
      `${baseName}_640w.${extension} 640w`,
      `${baseName}_960w.${extension} 960w`,
      `${baseName}_1280w.${extension} 1280w`,
    ].join(', ');
  };

  const imageStyle = {
    transition: 'opacity 0.3s ease-in-out',
    opacity: isLoaded ? 1 : 0.7,
    filter: isLoaded ? 'none' : 'blur(2px)',
    width: width || '100%',
    height: height || 'auto',
  };

  const placeholderStyle = {
    ...imageStyle,
    backgroundColor: '#f0f0f0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#999',
    fontSize: '14px',
    opacity: hasError || !isInView ? 1 : 0,
  };

  return (
    <div
      ref={imgRef}
      className={`lazy-image-container ${className}`}
      style={{ position: 'relative', overflow: 'hidden' }}
      {...props}
    >
      {/* Placeholder or error state */}
      <div
        style={placeholderStyle}
        className="lazy-image-placeholder"
      >
        {hasError ? (
          <span>Failed to load image</span>
        ) : !isInView ? (
          <div
            style={{
              width: '100%',
              height: '100%',
              backgroundImage: `url(${placeholder})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
            }}
          />
        ) : (
          <span>Loading...</span>
        )}
      </div>

      {/* Actual image */}
      {isInView && (
        <img
          src={src}
          srcSet={generateSrcSet(src)}
          sizes="(max-width: 320px) 320px, (max-width: 640px) 640px, (max-width: 960px) 960px, 1280px"
          alt={alt}
          style={imageStyle}
          onLoad={handleLoad}
          onError={handleError}
          loading="lazy"
          decoding="async"
          className="lazy-image"
        />
      )}
    </div>
  );
};

export default LazyImage;