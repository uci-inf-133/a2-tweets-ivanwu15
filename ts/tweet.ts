class Tweet {
	private text:string;
	time:Date;

	constructor(tweet_text:string, tweet_time:string) {
        this.text = tweet_text;
		this.time = new Date(tweet_time);//, "ddd MMM D HH:mm:ss Z YYYY"
	}

	//returns either 'live_event', 'achievement', 'completed_event', or 'miscellaneous'
    get source():string {
        const t = this.text.toLowerCase();

        // Live event tweets, e.g., "Watch my run right now..." or "#RKLive"
        if (t.includes('#rklive') || (t.includes('watch my') && t.includes(' live'))) {
          return 'live_event';
        }

        // Achievements, goals, fitness alerts
        if (
         t.includes('achieved a new personal record') ||
         t.startsWith('i just set a goal') ||
         t.includes('#fitnessalerts')
        ) {
         return 'achievement';
        }

        // Completed or posted activities
        if (t.startsWith('just completed a') || t.startsWith('just posted a')) return 'completed_event';
        
        return 'miscellaneous';
    }

    //returns a boolean, whether the text includes any content written by the person tweeting.
    get written():boolean {
        if (this.source !== 'completed_event') return false;
        return this.text.indexOf(' - ') !== -1;
    }

    get writtenText(): string {
      if (!this.written) return '';
      const after = (this.text.split(' - ')[1] || '')
        .replace(/https?:\/\/\S+/g, '')   // strip URLs
        .replace(/#runkeeper/gi, '')      // strip the common tag
        .trim();
      return after;
    }

    get activityType():string {
        if (this.source != 'completed_event') return "unknown";
        const t = this.text.toLowerCase();
        
        // Order matters (avoid catching "mtn bike" as "bike").
       if (t.includes('mtn bike')) return 'mtn bike';
       if (/\bride\b|\bbike\b/.test(t)) return 'bike';
       if (/\brun\b/.test(t)) return 'run';
       if (/\bwalk\b/.test(t)) return 'walk';
       if (/\bhike\b/.test(t)) return 'hike';
       if (/\bswim\b/.test(t)) return 'swim';
       if (/\brow\b/.test(t)) return 'row';
       if (/\belliptical\b/.test(t)) return 'elliptical';
       if (/\bmeditation\b/.test(t)) return 'meditation';
       if (/\bfreestyle\b/.test(t)) return 'freestyle';
       if (/\bcircuit\b/.test(t)) return 'circuit';
       return 'activity';
    }

    get distance():number {
        if (this.source !== 'completed_event') return 0;
        const t = (this.text || '').toLowerCase();
        const m = t.match(/([0-9]+(?:\.[0-9]+)?)\s?(mi|km)\b/);
        if (!m) return 0;
        const val = parseFloat(m[1]);
        const unit = m[2];
        return unit === 'km' ? val * 0.621371 : val; // miles
    }

    /** Day-of-week helpers for charts. */
    get weekdayIndex(): number { return this.time.getDay(); } // 0=Sun..6=Sat
    get weekdayName(): string { return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][this.weekdayIndex]; }

    getHTMLTableRow(rowNumber:number):string {
       const urlMatch = this.text.match(/https?:\/\/\S+/);
       const url = urlMatch ? urlMatch[0] : '#';
       const safeText = this.text
         .replace(/&/g, '&amp;')
         .replace(/</g, '&lt;')
         .replace(/>/g, '&gt;');
       return `<tr>
         <th scope="row">${rowNumber}</th>
         <td>${this.activityType}</td>
         <td><a href="${url}" target="_blank" rel="noopener">${safeText}</a></td>
       </tr>`;
    }
}