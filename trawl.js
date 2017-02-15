#!/usr/bin/env node
try {
    require('dotenv').config();
} catch(e) {
    console.warn('No dotenv configuration found');
}

const _ = require('lodash');
const fs = require('fs-extra');
const cli = require('cli');
const Twitter = require('twitter');

const username = 'everycolorbot';

/**
 * Creates a new instance of the Twitter client.
 *
 * @type {Twitter}
 */
const client = new Twitter({
    consumer_key: process.env.TWITTER_API_KEY,
    consumer_secret: process.env.TWITTER_API_SECRET,
    access_token_key: process.env.TWITTER_ACCESS_TOKEN,
    access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
});

/**
 * Synchronously handles an asynchronous promise.
 *
 * @param {function} generator
 */
const synchronousPromiseHandler = generator => {
    let iterator = generator();
    let loop = result => {
        !result.done && result.value.then(
            res => loop(iterator.next(res)),
            err => loop(iterator.throw(err))
        );
    };

    loop(iterator.next());
};

/**
 * Parses a collection of Tweets into a friendly array.
 *
 * @param {Array} tweets
 * @returns {Array}
 */
const parseTweetCollection = (tweets) => {
    let collection = [];

    for (const tweet of tweets) {
        collection.push({
            id: tweet.id_str,
            color: tweet.text.split(' ')[0].replace('0x', '#'),
            retweets: tweet.retweet_count,
            favourites: tweet.favorite_count,
            interactions: tweet.favorite_count + tweet.retweet_count,
        });
    }

    return collection;
};

/**
 * Parses through all available Tweets and stores the results in a JSON file.
 */
synchronousPromiseHandler(function* () {
    let params = {
        count: 200,
        trim_user: true,
        include_rts: false,
        exclude_replies: true,
        screen_name: username,
    };

    let collection = [];

    try {
        cli.info(`Trawling @${username}'s Tweets`);

        for (let i = 0; i < 100; i++) {
            collection = collection.concat(parseTweetCollection(yield client.get('statuses/user_timeline', params)));
            params.max_id = collection[collection.length - 1].id;

            cli.progress(i / 100)
        }

        cli.progress(1)
    } catch (err) {
        cli.error(err[0].message);
    } finally {
        const dir = process.env.COLOR_OUTPUT_DIR || `${__dirname}/dist/colors.json`;

        collection = _.uniqBy(collection, 'id');

        cli.info(`Trawling complete: ${collection.length} Tweets found`);
        cli.info(`Saving Tweets to: ${dir}`);

        // Use outputFile instead of outputJson so that we get a minified file.
        fs.outputFileSync(dir, JSON.stringify(_.sortBy(collection, 'interactions').reverse()));
    }
});
