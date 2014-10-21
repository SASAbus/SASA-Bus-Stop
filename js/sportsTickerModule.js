/**
 * Sports Ticker Directive
 *
 * @author Paul Pullen <paulpullen@gmail.com>
 * @license MIT
 */
'use strict';

angular.module('sportsTicker', ['ngSanitize'])
    .directive('sportsticker', ['$timeout', '$q', '$sanitize', function ($timeout, $q, $sanitize) {
        return {
            restrict: 'EAC',
            templateUrl: 'partials/ticker-template.html',
            replace: true,
            scope: {
                feed: '=',
                messageDelay: '=',
                scrollSpeedFactor: '='
            },
            link: function (scope, element, attrs) {

                var tickerPrimary,tickerIntro,tickerTopic,tickerMainContainer,tickerDivider,tmcWidth,scoreContainerMinWidth,
                    scoreContainerMaxWidth,scrollSpeedFactor;

                /**
                 * Don't init directive until we have a feed
                 */
                (function initTicker() {
                    $timeout(function(){
                        if(! scope.feed) {
                            initTicker();
                        } else {
                            /**
                             * Selectors
                             */
                            tickerPrimary = $(element).find('#st-ticker-primary');
                            tickerMainContainer = $(element).find('#st-ticker-main-container'); //default: opacity: 0

                            /**
                             * Initialize feed indices
                             */
                            scope.currentItem = 0;
                            recalcMq();

                            /**
                             * Animationend event handler
                             *
                             * After each animation completes, scope.currentAnimationsCount is incremented
                             * When scope.currentAnimationsCount == scope.animationsCount (the total number of defined animations for this item),
                             * we know that all elements' animations have completed, and can proceed to the next feed item
                             *
                             */
                            tickerPrimary.on('animationend webkitAnimationEnd MSAnimationEnd oAnimationEnd', '*[data-animations]', function () {
                                scope.currentAnimationsCount++;
                                if (scope.currentAnimationsCount == scope.animationsCount) {
                                    //console.log('Everything is done animating!');
                                    //run exit animations
                                    runExitAnimations().then(function () {
                                        getNextFeedItem().then(function () {
                                            displayFeedItem();
                                        });
                                    });
                                }
                            });

                            //kick off!
                            updateTopic().then(function () { //wait til topic animations are complete before displaying item
                                displayFeedItem();
                            });
                        }
                    }, 1000);
                })();

                /**
                 * Generate topic list
                 *
                 * If the number of available topics is less than the specified topic list length,
                 * wraparound for a circular list
                 *
                 * @returns {array} itemsRemaining
                 */
                    //get remaining topics for topicList
                scope.getTopics = function () {
                    //console.log('getTopics called');
                    //return topic indexes beginning with currentTopic to end of topics

                    if(scope.feed) {
                        var itemsRemaining = scope.feed.slice(scope.currentTopic, scope.feed.length);
                        var topicsListLength = 7;
                        var i = 0;

                        //if itemsRemaining < topicsListLength, wrap back around to beginning of list and pad
                        while (itemsRemaining.length < topicsListLength) {
                            itemsRemaining.push(scope.feed[i]);
                            var nextItem = scope.feed[i + 1];
                            nextItem ? i++ : i = 0;
                        }

                        return itemsRemaining;
                    }

                }

                /**
                 * Handle transition to new top-level topic
                 *
                 * Fades topic list in, shifts topic list items left with staggered animation, then fades out
                 *
                 * @returns {object} deferred.promise
                 */
                function updateTopic() {

                    var deferred = $q.defer();

                    //clear tickerPrimary of any remnants
                    tickerPrimary.html('');
                    deferred.resolve();


                    scope.indicators = []; //holds dummy elements for indicator lights
                    var count = scope.feed.length > 10 ? 10 : scope.feed.length;
                    for (var i = 0; i < count; i++) {
                        scope.indicators.push(i);
                        $timeout(function () { //why? because it wouldn't work without it for some reason...see here: http://stackoverflow.com/a/18582337/2769186
                            scope.$apply();
                        });
                    }

                    return deferred.promise;
                }

                /**
                 * Fade out all but current topic list item
                 *
                 * @returns {object} deferred.promise
                 */
                function fadeOutTopics() {

                    var deferred = $q.defer();

                    tickerTopic.show();
                    var itemsToFade = tickerIntro.find('li:gt(1)').length > 0 ? tickerIntro.find('li:gt(1)') : tickerIntro.find('li:lt(1)');
                    itemsToFade.fadeOut('slow', function () {
                        tickerIntro.hide(0, function () {
                            tickerMainContainer.css({opacity: 1, width: '0px'}).animate(
                                {
                                    width: tmcWidth
                                },
                                500,
                                'linear',
                                function () {
                                    //done with all animations here
                                    deferred.resolve();
                                }
                            );
                        });
                    });

                    return deferred.promise;
                }

                /**
                 * Update topic item indicator lights (below current topic item)
                 */
                function updateIndicators() {
                    //console.log('updateIndicators called');

                    if (scope.feed[scope.currentTopic].items.length < 10) {
                        $timeout(function () {
                            scope.$apply(function () {
                                scope.indicators.pop();
                            });
                        });
                    }
                }

                /**
                 * Get the next feed item
                 *
                 * If we're at the end of the feed, reset indices
                 *
                 * @returns {object} deferred.promise
                 */
                function getNextFeedItem() {
                    //console.log('getNextFeedItem called');

                    var deferred = $q.defer();

                    //if we have reached last subItem, check are we also at end of items?
                    //if not, go to first message of next item, update indicators, and return
                    if (scope.currentItem + 1 != scope.feed.length) {
                        scope.currentItem += 1;
                        updateIndicators();
                        deferred.resolve();
                        return deferred.promise;
                    }

                }

                /**
                 * Set animations for feed items
                 *
                 * Template elements may contain a data-animations attribute containing the CSS animations' names which should
                 * be applied to those elements upon insertion into the page
                 *
                 * Feed item messages share a custom set of CSS animation rules (slide_up, stay_put, marquee, and exit)
                 * These rules are dynamically-generated based upon factors such as message length, number of messages,
                 * whether or not a badge is present, and desired scroll speed
                 *
                 * The generated CSS rules for the feed item's elements are then appended to <head>, replacing the previous
                 * set of rules (if any)
                 *
                 * This approach makes it easy to both count animationend events (so we can determine when all elements have
                 * finished animating) and to create complex animations (by combining multiple smaller animations into a single
                 * animation rule).
                 *
                 */
                function setAnimations() {

                    //get badge width (used to determine left for all messages)
                    var badge = tickerPrimary.find('.ticker-badge span');
                    var badgeWidth = 15;
                    var tickerContainerWidth = tickerPrimary.find('.message').width();
                    //adjust scroll speed factor for smaller screens

                    var styles = ''; //will contain custom CSS styles to be injected into page

                    //describe animations for all elements EXCEPT messages (these are dynamically generated further down)
                    var animations = {
                        keyframes: [
                            '@keyframes badge_slide_in {0% {left: -' + badgeWidth + 'px} 100% {left: 0;}}',
                            '@keyframes slide_up {0% { top: 40px; } 100% { top: 0px; }}',
                            '@keyframes pause {0% { left: ' + badgeWidth + 'px; top: 0;} 100% { left: ' + badgeWidth + 'px; top: 0;}}',
                            '@keyframes score_slide_up {0% { top: 40px;} 100% { top: 0;}}',
                            '@keyframes fade_in { 0% {opacity: 0; width: 245px; } 100% {opacity: 1; width: 245px; }}',
                            '@keyframes expand { 0% { width: ' + scoreContainerMinWidth + '; } 100% { width: ' + scoreContainerMaxWidth + '; }}',
                            '@keyframes shrink { 0% { width: ' + scoreContainerMaxWidth + '; } 100% { width: ' + scoreContainerMinWidth + '; }}',
                            '@keyframes scale_up {0% {transform: scale(.5,.5)} 100% {transform: scale(1,1)}}'
                        ],
                        badge_slide_in: { css: 'badge_slide_in 250ms linear 0s' },
                        slide_up_fast: { css: 'slide_up 150ms linear 0s' },
                        score_slide_up: { css: 'score_slide_up 150ms linear 0s' },
                        fade_in: { css: 'fade_in 150ms linear 0ms' },
                        expand: { css: 'expand 300ms linear 0ms' },
                        shrink: { css: 'shrink 300ms linear 0ms' },
                        scale_up: { css: 'scale_up 900ms linear 0ms' }
                    };

                    //set all message widths (enforce a minimum of 275px) and scroll durations
                    //then set appropriate custom keyframes/animations classes
                    var messages = tickerPrimary.find('.message > ul li span');
                    var messageStartAt = 300; //in ms; first message animations starts at 300ms, second starts after all first have completed...

                    $.each(messages, function (i, msg) {
                        var messageWidth = $(msg).width() + 20;
                        var msgScrollDuration = Math.floor(messageWidth * scrollSpeedFactor); //set duration proportional to message width
                        var shouldScroll = messageWidth > (tickerContainerWidth - badgeWidth);

                        //for each message, set an appropriate keyframe rule and animations class on the animations object,
                        //then add this dynamically-generated rule to the element
                        //this animation will scroll item up, then scroll left if longer than ticker container width
                        //then exit
                        var slide_up = 'msg_' + i + '_slide_up';
                        var stay_put = 'msg_' + i + '_stay_put';
                        var marquee = 'msg_' + i + '_marquee';
                        var exit = 'msg_' + i + '_exit'; //slide up

                        var durations = {};
                        durations.slide_up = {
                            duration: 300,
                            startAt: messageStartAt
                        };
                        durations.stay_put = {
                            duration: Math.floor(scope.messageDelay / 2), //for scrolling messages, we'll only stay_put for half the normal message delay; otherwise, a "pause" is added to delay the full time
                            startAt: durations.slide_up.duration + durations.slide_up.startAt
                        };
                        durations.marquee = {
                            duration: (shouldScroll) ? msgScrollDuration : durations.stay_put.duration,
                            startAt: durations.stay_put.duration + durations.stay_put.startAt
                        };
                        durations.exit = {
                            duration: 300,
                            startAt: durations.marquee.duration + durations.marquee.startAt
                        };

                        //set messageStartAt for next iteration
                        //sum of all durations (since each animation begins when another ends, no need to count delays)
                        $.each(durations, function (i, obj) {
                            messageStartAt += obj.duration;
                        });

                        animations.keyframes.push('@keyframes ' + slide_up + ' {0% {left: ' + badgeWidth + 'px; top: 40px} 100% {left: ' + badgeWidth + 'px; top:0px}}');
                        animations.keyframes.push('@keyframes ' + stay_put + ' {0% {left: ' + badgeWidth + 'px; top: 0px} 100% {left: ' + badgeWidth + 'px; top:0px}}');
                        animations.keyframes.push('@keyframes ' + marquee + ' {0% { left: ' + badgeWidth + 'px; top: 0px;} 100% { left: -' + (messageWidth + 100) + 'px; top:0px;}}');
                        animations.keyframes.push('@keyframes ' + exit + ' {0% {top: 0px} 100% {top:-40px}}');
                        animations[slide_up] = { css: slide_up + ' ' + durations.slide_up.duration + 'ms linear ' + durations.slide_up.startAt + 'ms' };
                        animations[stay_put] = { css: stay_put + ' ' + durations.stay_put.duration + 'ms linear ' + durations.stay_put.startAt + 'ms' };
                        animations[marquee] = shouldScroll ?
                        {css: marquee + ' ' + durations.marquee.duration + 'ms linear ' + durations.marquee.startAt + 'ms' } :
                        {css: 'pause ' + durations.marquee.duration + 'ms linear ' + durations.marquee.startAt + 'ms' }; //if not scrolling, we'll just pause (hence the reason messageDelay is divided in half)
                        animations[exit] = {css: exit + ' ' + durations.exit.duration + 'ms linear ' + durations.exit.startAt + 'ms'};

                        //appropriate data-animations rule for each element so we can look up classes and set animation counts next
                        $(msg).parent('li').addClass('message_' + i).attr('data-animations', slide_up + ',' + stay_put + ',' + marquee + ',' + exit);

                        //if not scrolling marquee, keep in same place after animation ends
                        //to prevent flicker on scores-abbr, need to modify this
                        if (!shouldScroll) {
                            styles += '#st-wrapper .message > ul li.message_' + i + ' {left: ' + badgeWidth + 'px; top: -40px;}';
                        }
                    });

                    var els = tickerPrimary.find('*[data-animations]');
                    var animClasses = [];
                    scope.animationsCount = 0;

                    //get all animations defined on the el's data-animations attribute,
                    //set animationsCount, and add appropriate classes
                    $.each(els, function (i, el) {
                        var animData = $(el).data('animations').split(','); //get animations defined in JSON array on this data- attribute

                        scope.animationsCount += animData.length; //increment animations count for each animation added

                        //combine animations into a single animation css rule, separated by commas
                        //add this rule to animations obj
                        //add custom class representing this new rule to element
                        var newCssRuleName = 'animation_' + i;
                        var animationsCss = [];

                        $.each(animData, function (index, animationClass) {
                            //lookup animation class, get animation, and store css in anims
                            animationsCss.push(animations[animationClass].css);
                        });

                        //set animation fill-mode to forwards to prevent jumping back to original state when finished!
                        animations[newCssRuleName] = { css: '.' + newCssRuleName + '{ animation:' + animationsCss.join() + ';}' };
                        animClasses.push(newCssRuleName);
                        $(el).addClass(newCssRuleName);
                    });


                    //gather css rules for all animations present
                    for (var x = 0; x < animClasses.length; x++) {
                        if (x == 0) {
                            //add keyframes on first go around
                            $.each(animations.keyframes, function (i, kf) {
                                styles += kf;
                            });
                        }
                        styles += animations[animClasses[x]].css;
                    }

                    //insert css
                    $('head').find('#stStyles').remove();
                    $('head').append('<style id="stStyles" type="text/css">' + styles + '</style>');
                }

                function getMessagesHtml() {
                    var messages = scope.feed;
                    var messagesHtml = '<ul>';
                    $.each(messages, function (i, msg) {
                        messagesHtml += '<li><span>' + $sanitize(msg.titel_de) + '</span></li>'; //these animations are set dynamically
                    });
                    messagesHtml += '</ul>';

                    return messagesHtml;
                }


                /**
                 * Full message template
                 * @returns {string} template html
                 */
                function getFullTemplate() {
                    return '<div class="message" data-exit-animation="exit_message">' +
                        getMessagesHtml() +
                        '</div>';
                }

                /**
                 * Insert appropriate template html based on feed item type
                 */
                function insertTemplate() {
                    /*switch (scope.feed[scope.currentTopic].items[scope.currentItem][scope.currentSubItem].type) {
                        case "full-with-badge" :
                            tickerPrimary.html(getFullWithBadgeTemplate());
                            break;
                        case "full" :
                            tickerPrimary.html(getFullTemplate());
                            break;
                        case "scores" :
                            tickerPrimary.html(getScoresTemplate());
                            break;
                        case "scores-abbr" :
                            tickerPrimary.html(getScoresAbbrTemplate());
                            break;
                        case "matchup" :
                            tickerPrimary.html(getMatchupTemplate());
                            break;
                    }
			*/	
                    tickerPrimary.html(getFullTemplate());
                    setAnimations();
                }

                /**
                 *  Display the current feed item
                 *
                 *  Resets currentAnimationsCount for each new feed item
                 */
                function displayFeedItem() {
                    //insert feed item template
                    insertTemplate();

                    //reset scope.currentAnimationsCount
                    scope.currentAnimationsCount = 0;

                    // if inserted template has no animations defined (doubtful, but just in case),
                    // just go to next item immediately
                    if (scope.animationsCount == 0) {
                        getNextFeedItem().then(function () {
                            displayFeedItem();
                        });
                    }
                }

                /**
                 * Each template element may have a single data-exit-animation attribute containing a specific CSS animation
                 * class to use as its exit animation
                 *
                 * These are run after all other animations for the feed item have completed, just before the item is removed
                 * from the page
                 *
                 * @returns {object} deferred.promise
                 */
                function runExitAnimations() {
                    var deferred = $q.defer();

                    //for each element, run the exit animation specified on data-exit-animation property
                    //get animations list
                    var els = tickerPrimary.find('*[data-exit-animation]');
                    var totalExitAnimationsCount = els.length; //each el only has a single exit animation defined
                    var currentExitAnimationsCount = 0;

                    $.each(els, function (i, el) {
                        //console.log('exit animation called');
                        var exitAnimationClass = $(el).data('exit-animation');
                        $(el).addClass(exitAnimationClass)
                            .on('animationend webkitAnimationEnd MSAnimationEnd oAnimationEnd', function () {
                                currentExitAnimationsCount++;
                                $(el).remove();
                                if (totalExitAnimationsCount == currentExitAnimationsCount) {
                                    deferred.resolve();
                                }
                            });
                    });

                    return deferred.promise;
                }

                /**
                 * Recalcuate modernizr mq (on load and on window resize)
                 */
                function recalcMq() {
                    if (Modernizr.mq('(min-width: 1200px)')) {
                        tmcWidth = '900px';
                        scoreContainerMinWidth = '160px';
                        scoreContainerMaxWidth = '245px';
                        scrollSpeedFactor = scope.scrollSpeedFactor;
                    } else if (Modernizr.mq('(min-width: 992px)')) {
                        tmcWidth = '692px';
                        scoreContainerMinWidth = '117px';
                        scoreContainerMaxWidth = '196px';
                        scrollSpeedFactor = scope.scrollSpeedFactor * 1.5;
                    } else if (Modernizr.mq('(min-width: 768px)')) {
                        tmcWidth = '468px';
                        scoreContainerMinWidth = '79px';
                        scoreContainerMaxWidth = '129px';
                        scrollSpeedFactor = scope.scrollSpeedFactor * 2;
                    }

                    tickerMainContainer.width(tmcWidth);

                }

                $(window).resize(function () {
                    recalcMq();
                });
            }
        }
    }]);
