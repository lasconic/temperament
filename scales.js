//=============================================================================
//  MuseScore
//  Music Score Editor
//
//  " S C A L E S " plugin
//
//	Manages and applies score temperaments.
//	Version 0.7 - Date 11May2014
//
//	By Maurizio M. Gavioli, 2010.
//	Derived from a plugin by lasconic.
//
//  MuseScore: Copyright (C)2008 Werner Schweer and others
//
//  This program is free software; you can redistribute it and/or modify
//  it under the terms of the GNU General Public License version 2.
//
//  This program is distributed in the hope that it will be useful,
//  but WITHOUT ANY WARRANTY; without even the implied warranty of
//  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
//  GNU General Public License for more details.
//
//  You should have received a copy of the GNU General Public License
//  along with this program; if not, write to the Free Software
//  Foundation, Inc., 675 Mass Ave, Cambridge, MA 02139, USA.
//=============================================================================

// Global vars

// This array contains the difference between equal temperament and each temperament.
//	Each item of this array is itself an array with 36 items:
//	items from [0] to [34] are the tuning amounts (in cents) for each of the 35
//	'full enharmonic' scale tones (Cbb, Cb, C, C#, C##, Dbb...);
//	these items are ordered according to the circle of fifths:
//	0: Fbb, 1: Cbb ... 13: Bb, 14: F, 15: C ... 32: A##, 33: E##, 34: B##
//	the item ["Name"] is a string with the human-readale name of the temperament.
var g_temper = [];

var	g_numOfTempers	= 0;

// This array maps each step of each Scala scale type to the g_temper array
var	g_mapTemper = [];

// 7-step type: maps into 'white' keys and leave 'black' keys empty
g_mapTemper[0] = [ 15, 17, 19, 14, 16, 18, 20,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0];
//					C	D	E	F	G	A	B

// 12-step type: maps into all keys but needs three arrays, as the same value
//	is mapped into three enharmonic variants:
g_mapTemper[1] = [  3, 10, 17, 24, 31,  2,  9, 16, 23, 30,  1,  8,  0,  0,  0,  0,  0];
g_mapTemper[2] = [ 15, 22, 29,  0,  7, 14, 21, 28, 23,  6, 13, 20,  0,  0,  0,  0,  0];
g_mapTemper[3] = [ 27, 34,  5, 12, 19, 26, 33,  4, 11, 18, 25, 32,  0,  0,  0,  0,  0];
//				   Dbb Db  D   D#  D## Gbb Gb  G   G#  G## Cbb Cb
//				   C   C#  C## Fbb Fb  F   F#  F## --  Bbb Bb  B
//				   B#  B## Ebb Eb  E   E#  E## Abb Ab  A   A#  A##

// 17-step type: similar to above (mapping Db before C#, Eb before D# etc.
//	corresponds to Scala file most common situation: Scala files are sorted
//	by frequency and, in 17-step scales, bemol enharmony is usually lower
//	than diesis enharmony; there may be exception though, in these cases
//	our mapping will fail!)
g_mapTemper[4] = [  3, 10, 22, 17,  0, 24, 31,  2,  9, 21, 16, 11, 23, 30,  1, 25,  8];
g_mapTemper[5] = [ 15, 10, 22, 29,  0, 24,  7, 14,  9, 21, 28, 11, 23,  6, 13, 25, 20];
g_mapTemper[6] = [ 27, 10, 34,  5, 12, 24, 19, 26,  9, 33,  4, 11, 23, 18, 13, 25, 32];
//				   Dbb Db||--  D   -- |D#  D## Gbb Gb||--  G   --||G#  G## Cbb|--  Cb
//				   C   --||C#  C## Fbb|--  Fb  F   --||F#  F## --||--  Bbb Bb |--  B
//				   B#  --||B## Ebb Eb |--  E   E#  --||E## Abb Ab||--  A   -- |A#  A##

// This array returns the interval (in cents) of each steps of each scale type
// in the equal temperament
var g_mapEqual = [];
g_mapEqual[0] = [ 0, 200, 400, 500, 700, 900,1100,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0]; //  7-step type
g_mapEqual[1] = [ 0, 100, 200, 300, 400, 500, 600, 700, 800, 900,1000,1100,   0,   0,   0,   0,   0]; // 12-step type
g_mapEqual[3] = [ 0, 100, 100, 200, 300, 300, 400, 500, 600, 600, 700, 800, 800, 900,1000,1000,1100]; // 17-step type

// A value used to convert ratios to cents:
// Math.Log(r)*centFactor = 1200 * (ln(r) / ln(2)) = 1200 * log2(r) = log2^-1200(r)
var	g_centFactor = 1200 / Math.LN2;

// For MuseScore versions where the Note.tpc property is not implemented,
//	this array is used to convert a note_pitch/note_name_1st_char pair into
//	an index in the circle of fifths. The note pitch is taken module 12 and
//	from the 1st char of the name 'a' is subtracted.
//	Example: a pitch 50 may have a name of 'c##', 'd' or 'ebb';
//		50%12 = 2 and the 1st name char becomes 2, 3 or 4;
//		pitch * 8 + char will be: 18, 19, or 20
//		and each will map to the 29th, 17th or 5th fifth
var g_pitch2fifth =					// pitch	a   b   c   d   e   f   g   h
[	-1, 27, 15,  3, -1, -1, -1, 27,	//  0		-   B#  C   Dbb -   -   -   B#
	-1, 34, 22, 10, -1, -1, -1, 34,	//  1		-   B## C#  D   -   -   -   B##
	-1, -1, 29, 17,  5, -1, -1, -1,	//  2		-   -   C## D   Ebb -   -   -
	-1, -1, -1, 24, 12,  0, -1, -1,	//  3		-   -   -   D#  Eb  Fbb -   -
	-1, -1, -1, 31, 19,  7, -1, -1,	//  4		-   -   -   D## E   Fbb -   -
	-1, -1, -1, -1, 26, 14,  2, -1,	//  5		-   -   -   -   E#  F   Gbb -
	-1, -1, -1, -1, 33, 21,  9, -1,	//  6		-   -   -   -   E## F#  Gb  -
	 4, -1, -1, -1, -1, 28, 16, -1,	//  7		Abb -   -   -   -   F## G   -
	11, -1, -1, -1, -1, -1, 23, -1,	//  8		Ab  -   -   -   -   -   G#  -
	18,  6, -1, -1, -1, -1, 30,  6,	//  9		A   Bbb -   -   -   -   G## Bbb
	25, 13,  1, -1, -1, -1, -1, 13,	// 10		A#  Bb  Cbb -   -   -   -   Bb
	32, 20,  8, -1, -1, -1, -1, 20	// 11		A## B   Cb  -   -   -   -   B
];

// Global vars
var		g_form, g_form2;
var		g_bUseTpc;

//---------------------------------------------------------
//	init()
//	this function will be called on startup of mscore
//---------------------------------------------------------

function init()
{
}

//-------------------------------------------------------------------
//	run()
//	this function will be called when activating the plugin menu entry
//
//	global Variables:
//	pluginPath - contains the plugin path; file separator is "/"
//-------------------------------------------------------------------

function run()
{

    if (typeof curScore === 'undefined')
    {	
        QMessageBox.critical(null, "Scales Plugin Error", "No score is open");
		return;
    }

	// determine version
	g_bUseTpc = (mscoreVersion != undefined && mscoreVersion >= 906);
	// create the UI
	var loader = new QUiLoader(null);
	var file   = new QFile(pluginPath + "/scales.ui");
	file.open(QIODevice.OpenMode(QIODevice.ReadOnly, QIODevice.Text));
	g_form = loader.load(file, null);
	g_form.pushImport.clicked.connect(importTemper);
	g_form.pushAdd.clicked.connect(addTemper);
	g_form.pushEditFifths.clicked.connect(editTemperFifths);
	g_form.pushEditScale.clicked.connect(editTemperScale);
	g_form.pushDelete.clicked.connect(deleteTemper);
	g_form.pushOk.clicked.connect(applyTemper);
	g_form.pushCancel.clicked.connect(dlgDone);
	// init controls
	loadTemper(pluginPath + "/scales.tmpr");	// load the built-in temperaments
	g_form.radioAFreq.setChecked(true);
	g_form.lineFrom.setText("440");
	g_form.lineTo.setText("440");
	g_form.lineCent.setText("0");
	g_form.show();								// show the dlg
}

//---------------------------------------------------------
//	applyTemper()
//	called when user presses "Accept" button
//	applies the currently selected temperament to the whole score.
//---------------------------------------------------------

function applyTemper()
{	var		aOffset;
	var		chordnote, staff, voice;
	var		cursor;
	var		idx;
	var		name, note, pitch, tpc;
	var		temper;

	//get selected temperament and pick the right item in g_temper array
	idx = g_form.comboTemper.currentIndex;
	temper = g_temper[idx];

	// get A tuning option
	if(g_form.radioAFreq.checked)					// if A is given as freq:
	{	aOffset = parseInt(g_form.lineFrom.text);	// get 'from' frequency
		if(aOffset == 0)						// and make sure it is NOT 0
			aOffset = 0;
		else
		{	aOffset = parseInt(g_form.lineTo.text) / aOffset;	// get frequency ratio
			aOffset = Math.log(aOffset) * g_centFactor;		// convert to cent
		}
	}
	else										// if A is given as cent
	{	aOffset = parseInt(g_form.lineCent.text);	// get cent difference
	}
	aOffset = Math.round(aOffset - temper[18]);	// adjust with temper. value for A
	
	// for each note of each chord of each part of each staff
	cursor = new Cursor(curScore);
	curScore.startUndo();
	for (staff = 0; staff < curScore.staves; ++staff)
	{	cursor.staff = staff;
		for (voice = 0; voice < 4; voice++)
		{	cursor.voice = voice;
			cursor.rewind();					// set cursor to first chord/rest

			while (!cursor.eos())
			{	if (cursor.isChord())
				{	for (chordnote = 0; chordnote < cursor.chord().notes; chordnote++)
					{	note	= cursor.chord().note(chordnote);
						if(g_bUseTpc)
							idx		= note.tpc+1;
						else
						{	pitch	= note.pitch % 12;
							name	= note.name;
							idx		= name.charCodeAt(0) - 97;	// 97 = 'a'
							// name 1st char should be between 'a' and 'h'
							if(idx < 0 || idx > 7)
								continue;
							idx = pitch * 8 + idx;				// note idx => table idx
							idx = g_pitch2fifth[idx];			// table idx => fifth idx
						}
						if(idx != -1)
							note.tuning += temper[idx] + aOffset;
					}
				}
				cursor.next();
			}
		}
	}
	curScore.endUndo();
	g_form.accept();
}

function dlgDone()
{	g_form.reject();
}

//---------------------------------------------------------
//	importTemper()
//	called when user presses the "Import Scala file" button:
//	opens a file selection dlg and imports the selected file
//---------------------------------------------------------

function importTemper()
{	var		count;
	var		interval;
	var		line;
	var		name;
	var		newTemper = [];
	var		numOfSteps;

	// open a file selection dlg
	var fName = QFileDialog.getOpenFileName(g_form, "Select Scala file to import",
			".", "Scala file (*.scl)", 0);
	if(fName == null)
		return;

	// open the file as a text stream
	var file = new QFile(fName);
	if( !file.open(QIODevice.ReadOnly) )
	{	QMessageBox.critical(g_form, "File Error", "Could not open file " + fName);
		return;
	}
	var textStream = new QTextStream(file);

	// read 1 line with scale name, skipping comments ("! ...")
	do
	{	line = textStream.readLine();
	} while(line[0] == '!');
	name = line;						// store scale name

	// read 1 line with number of scale steps, skipping comments
	do
	{	line = textStream.readLine();
	} while(line[0] == "!");
	numOfSteps = parseInt(line);		// store number of scale steps

	// map scale type
	switch(numOfSteps)
	{
	case 7:
		type = 0;
		break;
	case 12:
		type = 1;
		break;
	case 17:
		type = 4;
		break;
	default:							// only scales with 7, 12 or 17 steps are acceptable
		QMessageBox.critical(g_form, "Invalid scale", "Only scales with 7, 12 or 17 steps are acceptable!");
		return;
	}

	// initialize newTemper to all 0's
	for(count=0; count < 35; count++)
		newTemper[count] = 0;

	// read step values. We read only numOfSteps-1 lines of steps;
	// in Scala files, step 0 is not listed and implicitly assumed to be 0
	// we include the first step but ignore the last step, implicitly assumed to be 2
	// whence Scala values are all shifted 1 step to the 'right'
	for(count=1; count < numOfSteps; count++)
	{	do
		{	line = textStream.readLine();
		} while(line[0] == "!");
		// extract the first expression: Scala expressions are made
		// of decimal digits, the decimal dot and '/'
		var exp = line.match(/[0-9]+\.[0-9]*|[0-9]+\/[0-9]+/);
		if(exp == null)
		{	QMessageBox.critical(g_form, "Invalid scale", "Could not understand value no. " + count);
			return;
		}
		// evaluate the extracted expression
		interval = eval(exp[0]);

		// if the textual representation of value did not contains a period,
		// it is a ratio to be converted into cents (3986.... is 1200*log(2) )
		if(exp[0].indexOf(".") == -1)
			interval = Math.log(interval) * g_centFactor;
		// reduce cent interval to an integral delta from equal temperament
		interval = Math.round(interval);
		interval -= g_mapEqual[type][count];

		// map the interval into the proper temperament step, according to scale type
		newTemper[g_mapTemper[type][count]] = interval;
		// 12-step and 17-step types have 3 enharmonic alternatives
		if(type > 0)
		{	newTemper[g_mapTemper[type+1][count]] = interval;
			newTemper[g_mapTemper[type+2][count]] = interval;
		}
	}
	newTemper["Name"] = name;
	file.close();

	// if we got so far, add the new temperament to the combo box and to the g_temper array
	g_form.comboTemper.addItem(name);
	g_temper[g_numOfTempers] = newTemper;
	g_numOfTempers++;
	saveTemper(pluginPath + "/scales.tmpr");
}

//---------------------------------------------------------
//	addTemper()
//	called when user presses the "Add" button
//	Adds a new (empty) temperament and open the edit dlg box
//---------------------------------------------------------

function addTemper()
{	var		idx;
	var		newTemper = [];

	// init the new temperament to default data
	newTemper["Name"] = "[new temperament]";
	for(idx=0; idx < 35; idx++)
		newTemper[idx] = 0;

	// if editing successful
	if(editTemper(newTemper, "/scales_e35a.ui"))
	{	g_form.comboTemper.addItem(newTemper["Name"]);// add to combo box
		g_form.comboTemper.setCurrentIndex(g_numOfTempers);
		g_temper[g_numOfTempers] = newTemper;		// add to internal data
		g_numOfTempers++;
		saveTemper(pluginPath + "/scales.tmpr");	// save data
	}
}

//---------------------------------------------------------
//	editTemperScale() / editTemperFifths()
//	called when user presses the "Edit as scale/fifth" buttons
//---------------------------------------------------------

function editTemperFifths()
{	var		idx;
	var		temper;

	//get selected temperament and pick the right item in g_temper array
	idx = g_form.comboTemper.currentIndex;
	temper = g_temper[idx];
	if(editTemper(temper, "/scales_e35a.ui"))
	{	saveTemper(pluginPath + "/scales.tmpr");
		g_form.comboTemper.setItemText(idx, temper["Name"]);
	}
}

function editTemperScale()
{	var		idx;
	var		temper;

	//get selected temperament and pick the right item in g_temper array
	idx = g_form.comboTemper.currentIndex;
	temper = g_temper[idx];
	if(editTemper(temper, "/scales_e35b.ui"))
	{	saveTemper(pluginPath + "/scales.tmpr");
		g_form.comboTemper.setItemText(idx, temper["Name"]);
	}
}

function editTemper(temper, dlgFName)
{	var		step;
	var		widget;

	// create the UI
	var loader = new QUiLoader(null);
	var file   = new QFile(pluginPath + dlgFName);
	file.open(QIODevice.OpenMode(QIODevice.ReadOnly, QIODevice.Text));
	g_form2 = loader.load(file, null);
	g_form2.radio7.clicked.connect(dlgShow7);
	g_form2.radio12.clicked.connect(dlgShow12);
	g_form2.radio17.clicked.connect(dlgShow17);
	g_form2.radio35.clicked.connect(dlgShow35);
	g_form2.pushOk.clicked.connect(dlgAccept);
	g_form2.pushCancel.clicked.connect(dlgReject);
	g_form2.radio35.setChecked(true);		// show all keys by default
	// fill dlg with temperament data
	g_form2.lineName.setText(temper["Name"]);
//	for(step=0; step < 35; step++)
//	{	widget = g_form2.findChild("eK"+step);
//		if(widget != null)
//			widget.setText(""+temper[step]);
//	}
	g_form2.eK0.setText(temper[0]);
	g_form2.eK1.setText(temper[1]);
	g_form2.eK2.setText(temper[2]);
	g_form2.eK3.setText(temper[3]);
	g_form2.eK4.setText(temper[4]);
	g_form2.eK5.setText(temper[5]);
	g_form2.eK6.setText(temper[6]);
	g_form2.eK7.setText(temper[7]);
	g_form2.eK8.setText(temper[8]);
	g_form2.eK9.setText(temper[9]);
	g_form2.eK10.setText(temper[10]);
	g_form2.eK11.setText(temper[11]);
	g_form2.eK12.setText(temper[12]);
	g_form2.eK13.setText(temper[13]);
	g_form2.eK14.setText(temper[14]);
	g_form2.eK15.setText(temper[15]);
	g_form2.eK16.setText(temper[16]);
	g_form2.eK17.setText(temper[17]);
	g_form2.eK18.setText(temper[18]);
	g_form2.eK19.setText(temper[19]);
	g_form2.eK20.setText(temper[20]);
	g_form2.eK21.setText(temper[21]);
	g_form2.eK22.setText(temper[22]);
	g_form2.eK23.setText(temper[23]);
	g_form2.eK24.setText(temper[24]);
	g_form2.eK25.setText(temper[25]);
	g_form2.eK26.setText(temper[26]);
	g_form2.eK27.setText(temper[27]);
	g_form2.eK28.setText(temper[28]);
	g_form2.eK29.setText(temper[29]);
	g_form2.eK30.setText(temper[30]);
	g_form2.eK31.setText(temper[31]);
	g_form2.eK32.setText(temper[32]);
	g_form2.eK33.setText(temper[33]);
	g_form2.eK34.setText(temper[34]);
	if(g_form2.exec() != QDialog.Accepted)					// show the dlg
		return false;
	// copy back edited data
	temper["Name"] = g_form2.lineName.text;
//	for(step=0; step < 35; step++)
//	{	widget = g_form2.findChild("eK"+step);
//		if(widget != null)
//			temper[step] = parseInt(widget.text);
//	}
	temper[0] = parseInt( g_form2.eK0.text );
	temper[1] = parseInt( g_form2.eK1.text );
	temper[2] = parseInt( g_form2.eK2.text );
	temper[3] = parseInt( g_form2.eK3.text );
	temper[4] = parseInt( g_form2.eK4.text );
	temper[5] = parseInt( g_form2.eK5.text );
	temper[6] = parseInt( g_form2.eK6.text );
	temper[7] = parseInt( g_form2.eK7.text );
	temper[8] = parseInt( g_form2.eK8.text );
	temper[9] = parseInt( g_form2.eK9.text );
	temper[10]= parseInt( g_form2.eK10.text);
	temper[11]= parseInt( g_form2.eK11.text);
	temper[12]= parseInt( g_form2.eK12.text);
	temper[13]= parseInt( g_form2.eK13.text);
	temper[14]= parseInt( g_form2.eK14.text);
	temper[15]= parseInt( g_form2.eK15.text);
	temper[16]= parseInt( g_form2.eK16.text);
	temper[17]= parseInt( g_form2.eK17.text);
	temper[18]= parseInt( g_form2.eK18.text);
	temper[19]= parseInt( g_form2.eK19.text);
	temper[20]= parseInt( g_form2.eK20.text);
	temper[21]= parseInt( g_form2.eK21.text);
	temper[22]= parseInt( g_form2.eK22.text);
	temper[23]= parseInt( g_form2.eK23.text);
	temper[24]= parseInt( g_form2.eK24.text);
	temper[25]= parseInt( g_form2.eK25.text);
	temper[26]= parseInt( g_form2.eK26.text);
	temper[27]= parseInt( g_form2.eK27.text);
	temper[28]= parseInt( g_form2.eK28.text);
	temper[29]= parseInt( g_form2.eK29.text);
	temper[30]= parseInt( g_form2.eK30.text);
	temper[31]= parseInt( g_form2.eK31.text);
	temper[32]= parseInt( g_form2.eK32.text);
	temper[33]= parseInt( g_form2.eK33.text);
	temper[34]= parseInt( g_form2.eK34.text);
	return true;
}

//---------------------------------------------------------
//	dlgShow..()
//	shows only .. number of fifths
//---------------------------------------------------------

function dlgShow7()
{	dlgShowKeys(7);
}

function dlgShow12()
{	dlgShowKeys(12);
}

function dlgShow17()
{	dlgShowKeys(17);
}

function dlgShow35()
{	dlgShowKeys(35);
}

function dlgShowKeys(nKeys)
{	g_form2.eK0.setVisible (nKeys >= 35);
	g_form2.eK1.setVisible (nKeys >= 35);
	g_form2.eK2.setVisible (nKeys >= 35);
	g_form2.eK3.setVisible (nKeys >= 35);
	g_form2.eK4.setVisible (nKeys >= 35);
	g_form2.eK5.setVisible (nKeys >= 35);
	g_form2.eK6.setVisible (nKeys >= 35);
	g_form2.eK7.setVisible (nKeys >= 35);
	g_form2.eK8.setVisible (nKeys >= 35);
	g_form2.eK9.setVisible (nKeys >= 17);
	g_form2.eK10.setVisible(nKeys >= 17);
	g_form2.eK11.setVisible(nKeys >= 12);
	g_form2.eK12.setVisible(nKeys >= 12);
	g_form2.eK13.setVisible(nKeys >= 12);
//	g_form2.eK14.setVisible(nKeys >=  7);
//	g_form2.eK15.setVisible(nKeys >=  7);
//	g_form2.eK16.setVisible(nKeys >=  7);
//	g_form2.eK17.setVisible(nKeys >=  7);
//	g_form2.eK18.setVisible(nKeys >=  7);
//	g_form2.eK19.setVisible(nKeys >=  7);
//	g_form2.eK20.setVisible(nKeys >=  7);
	g_form2.eK21.setVisible(nKeys >= 12);
	g_form2.eK22.setVisible(nKeys >= 12);
	g_form2.eK23.setVisible(nKeys >= 17);
	g_form2.eK24.setVisible(nKeys >= 17);
	g_form2.eK25.setVisible(nKeys >= 17);
	g_form2.eK26.setVisible(nKeys >= 35);
	g_form2.eK27.setVisible(nKeys >= 35);
	g_form2.eK28.setVisible(nKeys >= 35);
	g_form2.eK29.setVisible(nKeys >= 35);
	g_form2.eK30.setVisible(nKeys >= 35);
	g_form2.eK31.setVisible(nKeys >= 35);
	g_form2.eK32.setVisible(nKeys >= 35);
	g_form2.eK33.setVisible(nKeys >= 35);
	g_form2.eK34.setVisible(nKeys >= 35);
}

//---------------------------------------------------------
//	dlgAccept() / dlgReject()
//	called when user presses either the "OK" or the "Cancel" button
//---------------------------------------------------------

function dlgAccept()
{	g_form2.accept();
}

function dlgReject()
{	g_form2.reject();
}

//---------------------------------------------------------
//	deleteTemper()
//	called when user presses the "Delete current temperament" button:
//	removes the selected temperament from the combo box and from the internal data.
//	Data are saved and the built-in temper. file overwritten.
//---------------------------------------------------------

function deleteTemper()
{	var		idx;
	var		temper;

	//get selected temperament and pick it from the array
	idx = g_form.comboTemper.currentIndex;

	// ask the user for a confirmation
	// using custom buttons to show "Yes" / "No" does not seem to work!
	if(QMessageBox.question(g_form, "Delete temperament",
			"\"" + g_temper[idx]["Name"] +
			"\" will permanently deleted\nProceed? (press ESC to abort)") != QMessageBox.Ok)
		return;

	// remove item from combo box
	g_form.comboTemper.removeItem(idx);
	// remove item from internal data, shifting all 'next' temperaments 'down' one slot
	for(temper = idx; temper < g_numOfTempers-1; temper++)
		g_temper[temper] = g_temper[temper+1];
	g_temper.pop();						// remove last temperament
	g_numOfTempers--;
	saveTemper(pluginPath + "/scales.tmpr");
}

//---------------------------------------------------------
//	loadTemper(fName)
//	loads a file with temperament data and adds them to the combo box and
//	to the internal data. No attempt is made to recognize if an identical
//	temperament is already loaded.
//---------------------------------------------------------

function loadTemper(fName)
{	var		line, name;
	var		numOfTempers, numOfSteps;
	var		newTemper;
	var		step, temper;
	var		type, val;

	// open data file as a text stream
	var file = new QFile(fName);
	if( !file.open(QIODevice.ReadOnly) )
	{	QMessageBox.critical(g_form, "File Error", "Could not open data file " + fName);
		return;
	}
	var textStream = new QTextStream(file);

	line = textStream.readLine();	// a line with the number of temperaments in the file
	numOfTempers = parseInt(line);
	if(numOfTempers == null || numOfTempers < 1)
	{	QMessageBox.warning(g_form, "File Error", "Nothing to read from file " + fName);
		return;
	}

	// for each temperament
	for(temper=0; temper < numOfTempers; temper++)
	{	// a line with the name and a line with the type
		name = textStream.readLine();
		if(name == null || name == "")
			name = "[No name - " + g_numOfTempers + "]";
		line = textStream.readLine();
		type = parseInt(line);
		switch(type)
		{
		case 1:
			numOfSteps = 35;
			break;
		default:
			QMessageBox.critical(g_form, "File Error", "Unknown type for temperament no. " + (temper+1));
			return;
		}
		newTemper = new Array();
		// a line for each value
		for(step = 0; step < numOfSteps; step++)
		{	line = textStream.readLine();
			val = parseInt(line);
			if(val == NaN)
			{	QMessageBox.warning(g_form, "File Error",
						"Invalid value for line " + (step+1) +
						" of temperament " + (temper+1) );
				return;
			}
			newTemper[step] = val;
		}
		newTemper["Name"] = name;
		// if we got so far, add the new temperament to the combo box and to the g_temper array
		g_form.comboTemper.addItem(name);
		g_temper[g_numOfTempers] = newTemper;
		g_numOfTempers++;
	}
	file.close();
}

//---------------------------------------------------------
//	saveTemper(fName)
//	saves temperament names and data to a text file
//---------------------------------------------------------

function saveTemper(fName)
{	var		temper, step;

	// open data file as a text stream
	var file = new QFile(fName);
	if(file.exists())
		file.remove();
	if( !file.open(QIODevice.ReadWrite) )
	{	QMessageBox.critical(g_form, "File Error", "Could not open data file");
		return;
	}
	var textStream = new QTextStream(file);

	// a line with the number of temperaments
	textStream.writeString(""+g_numOfTempers+"\n");
	// for each temperament
	for(temper=0; temper < g_numOfTempers; temper++)
	{	// a line with the name and a line with the type
		textStream.writeString(g_temper[temper]["Name"]+"\n");
		textStream.writeString("1\n");
		// a line for each value
		for(step = 0; step < 35; step++)
			textStream.writeString(""+g_temper[temper][step]+"\n");
	}
	file.close();
}

//---------------------------------------------------------
//    menu:  defines were the function will be placed
//           in the MuseScore menu structure
//---------------------------------------------------------

var mscorePlugin =
{	menu:	'Plugins.Scales',
	init:	init,
	run:	run
};

mscorePlugin;
