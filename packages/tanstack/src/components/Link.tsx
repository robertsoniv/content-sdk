import React, { forwardRef, JSX } from 'react';
import { Link as TanstackLink } from '@tanstack/react-router';
import {
  Link as ReactLink,
  LinkFieldValue,
  LinkField,
  LinkProps as ReactLinkProps,
} from '@sitecore-content-sdk/react';

export type LinkProps = ReactLinkProps & {
  /**
   * If `href` match with `internalLinkMatcher` regexp, then it's internal link and TanstackLink will be rendered
   * @default /^\//g
   */
  internalLinkMatcher?: RegExp;
  /**
   * TanStack Router Link prefetch behavior.
   */
  preload?: 'intent' | 'render' | 'viewport' | false;
};

/**
 * Matches relative URLs that end with a file extension.
 */
const FILE_EXTENSION_MATCHER = /^\/.*\.\w+$/;

export const Link = forwardRef<HTMLAnchorElement, LinkProps>(
  (props: LinkProps, ref): JSX.Element | null => {
    const {
      field,
      editable = true,
      children,
      internalLinkMatcher = /^\//g,
      showLinkTextWithChildrenPresent,
      ...htmlLinkProps
    } = props;

    if (!field || (!field.value && !(field as LinkFieldValue).href && !field.metadata)) {
      return null;
    }

    const value = (
      (field as LinkFieldValue).href ? field : (field as LinkField).value
    ) as LinkFieldValue;
    // fallback to {} if value is undefined; could happen if field is LinkFieldValue, href is empty in metadata mode
    const { href, querystring, anchor } = value || {};

    const isEditing = editable && (field as LinkFieldValue).metadata;

    if (href && !isEditing) {
      const text = showLinkTextWithChildrenPresent || !children ? value.text || value.href : null;

      const isMatching = internalLinkMatcher.test(href);
      const isFileUrl = FILE_EXTENSION_MATCHER.test(href);

      // determine if a link is a route or not. File extensions are not routes and should not be pre-fetched.
      if (isMatching && !isFileUrl) {
        // Build the full path with query string and anchor
        const fullPath =
          href + (querystring ? `?${querystring}` : '') + (anchor ? `#${anchor}` : '');

        return (
          <TanstackLink
            to={fullPath}
            key="link"
            title={value.title}
            target={value.target}
            className={value.class}
            preload={props.preload}
            {...htmlLinkProps}
            ref={ref}
            {...(process.env.TEST
              ? {
                  'data-tanstack-link': true,
                  'data-tanstack-preload': props.preload,
                }
              : {})}
          >
            {text}
            {children}
          </TanstackLink>
        );
      }
    }

    // prevent passing internalLinkMatcher or preload as it is an invalid DOM element prop
    const reactLinkProps = { ...props };
    delete reactLinkProps.internalLinkMatcher;
    delete reactLinkProps.preload;

    return (
      <ReactLink
        {...reactLinkProps}
        ref={ref}
        {...(process.env.TEST ? { 'data-react-link': true } : {})}
      />
    );
  }
);

Link.displayName = 'TanstackLink';
