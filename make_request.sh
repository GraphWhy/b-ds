#!/bin/bash
# Make simple requests to DynamicStory API.

backend=127.0.0.1:3000
curl_extra=
username=
email=
password=
newPassword=
activationId=
page=
token=
story=
title=
narrative=
question=
answer0=
answer1=
answer2=
answer3=
answer4=
answer=
feedback=

# die
# Exit in an error
function die {
	exit -1
}

# msg
# Print a message
function msg {
	echo "$@"
}

# err
# Print an error message
function err {
	echo "$@" >&2
}

# have_arg flag
# Returns 0 if the variable named by $name exists.
#  e.g.: have_arg "username"
function have_arg {
	local name
	local value
	name=$1
	eval "value=\$$name"
	if [ -n "$value" ]; then
		return 0
	else
		return 1
	fi
}

# need_arg flag name
# Dies unless the arg named by $name exists.
#  e.g.: need_arg "-u" "username"
function need_arg {
	local flag
	local name
	flag=$1
	name=$2
	if ! have_arg $name; then
		err "Need $name. Pass in with $flag."
		die
	fi
}

# need_arg_from [flag name]...
# Dies unless at least one arg named by a $name exists.
#  e.g.: need_arg_from "-u" "username" "-p" "password"
function need_arg_from {
	local arg_names
	while [ -n "$1" ]; do
		local flag
		local name
		flag=$1
		name=$2
		shift 2

		if [ -z "$arg_names" ]; then
			arg_names="$flag $name"
		else
			arg_names="$arg_names or $flag $name"
		fi

		if have_arg $name; then
			return 0
		fi
	done
	err "Need one of: ${arg_names}."
	die
}

# need_backend_running
# Dies unless the backend is running.
function need_backend_running {
	host=$(echo $backend | sed 's/:.*//')
	port=$(echo $backend | sed 's/.*://')
	if [ -z "$host" ]; then
		host=127.0.0.1
	fi
	if [ -z "$port" ]; then
		port=80
	fi
	if ! type nc >/dev/null 2>&1; then
		# We don't have netcat installed.
		return
	fi
	if ! (nc $host $port </dev/null >/dev/null 2>&1); then
		err "Could not find backend running at ${backend}."
		die
	fi
}

# http_request method route [CURL_ARG]...
# Makes an HTTP request.
#  e.g.: http_request POST /user --data-urlencode "username=$username"
#                                --data-urlencode "email=$email"
#                                --data-urlencode "password=$password"
function http_request {
	method=$1
	route=$2
	shift 2
	curl $curl_extra -X $method http://$backend/v1$route "$@"
}

# help
# Displays usage information
function help {
	cat <<-EOF
	usage: $0 [OPTIONS...] api-call

	Available API calls are:
	          [-u username] [-e email] [-p password] user/create
	          [-t token] user/delete
	          <-u username|-e email> [-p password] user/authenticate
	          [-t token] user/requthenticate
	          [-t token] user/logout
	          [-t token] [-p password] [-w new password] user/changepassword
		  [-c activation id] user/activate

	          [-g page] feed

	          [-t token] [-i title] [-n narrative] [-q question] story/create
	          [-s story] story/get
	          [-s story] [-t token] story/delete

	          [-t token] [-i title] [-01234 answers] question/create
	          [-q question] question/get
	          [-q question] [-t token] [-a answer] [-s story] question/vote

	          [-t token] [-f feedback] feedback

	Global options available to all methods are:
	          -b host:port    Switch backend location
	          -v              "Verbose." Show entire request and response

	Backend defaults to $backend

	Examples:
	        $0 -u user -e user@example.com -p password user/create
	        $0 -u user -p password user/authenticate
	        $0 feed
	        $0 -s 54e59cc40b987e871cdfbea4 story/get
	EOF
}

function main {
	while getopts b:vu:e:p:w:c:g:t:s:i:n:q:0:1:2:3:4:a:f:h opt; do
		case $opt in
		b) backend=$OPTARG;;
		v) curl_extra="$curl_extra --trace-ascii -";;
		u) username=$OPTARG;;
		e) email=$OPTARG;;
		p) password=$OPTARG;;
		w) newPassword=$OPTARG;;
		c) activationId=$OPTARG;;
		g) page=$OPTARG;;
		t) token=$OPTARG;;
		s) story=$OPTARG;;
		i) title=$OPTARG;;
		n) narrative=$OPTARG;;
		q) question=$OPTARG;;
		0) answer0=$OPTARG;;
		1) answer1=$OPTARG;;
		2) answer2=$OPTARG;;
		3) answer3=$OPTARG;;
		4) answer4=$OPTARG;;
		a) answer=$OPTARG;;
		f) feedback=$OPTARG;;
		h) help; exit;;
		?) exit;;
		esac
	done

	need_backend_running

	# Skip getopts handled options.
	shift $((OPTIND-1))

	case $1 in

	user/create)
		need_arg -u username
		need_arg -e email
		need_arg -p password
		http_request POST /user \
			--data-urlencode "username=$username" \
			--data-urlencode "email=$email" \
			--data-urlencode "password=$password"
		;;

	user/delete)
		need_arg -t token
		http_request DELETE /user \
			--header "token: $token"
		;;

	user/authenticate)
		need_arg_from -u username -e email
		need_arg -p password
		http_request POST /user/authenticate \
			--data-urlencode "usernameemail=$username$email" \
			--data-urlencode "password=$password"
		;;

	user/reauthenticate)
		need_arg -t token
		http_request POST /user/reauthenticate \
			--header "token: $token"
		;;

	user/logout)
		need_arg -t token
		http_request POST /user/logout \
			--header "token: $token"
		;;

	user/changepassword)
		need_arg -t token
		need_arg -p password
		need_arg -w newPassword
		http_request PUT /user/password \
			--header "token: $token" \
			--data-urlencode "oldPassword=$password" \
			--data-urlencode "newPassword=$newPassword"
		;;

	user/activate)
		need_arg -c activationId
		http_request POST /user/activate \
			--data-urlencode "activationid=$activationId"
	;;

	feed)
		need_arg -g page
		http_request GET /feed/$page
		;;

	story/create)
		need_arg -t token
		need_arg -i title
		need_arg -n narrative
		need_arg -q question
		http_request POST /story \
			--header "token: $token" \
			--data-urlencode "title=$title" \
			--data-urlencode "narrative=$narrative" \
			--data-urlencode "question=$question"
		;;

	story/get)
		need_arg -s story
		http_request GET /story/$story
		;;

	story/delete)
		need_arg -s story
		need_arg -t token
		http_request DELETE /story/$story \
			--header "token: $token"
		;;

	question/create)
		need_arg -t token
		need_arg -i title
		need_arg -0 answer0
		need_arg -1 answer1
		need_arg -2 answer2
		need_arg -3 answer3
		need_arg -4 answer4
		http_request POST /question \
			--header "token: $token" \
			--data-urlencode "title=$title" \
			--data-urlencode "answers[]=$answer0" \
			--data-urlencode "answers[]=$answer1" \
			--data-urlencode "answers[]=$answer2" \
			--data-urlencode "answers[]=$answer3" \
			--data-urlencode "answers[]=$answer4"
		;;

	question/get)
		need_arg -q question
		http_request GET /question/$question
		;;

	question/vote)
		need_arg -q question
		need_arg -t token
		need_arg -a answer
		need_arg -s story
		http_request POST /question/$question/vote \
			--header "token: $token" \
			--data-urlencode "answer=$answer" \
			--data-urlencode "story=$story"
		;;

	feedback)
		need_arg -t token
		need_arg -f feedback
		http_request POST /feedback \
			--header "token: $token" \
			--data-urlencode "feedback=$feedback"
		;;

	*)
		help >&2
		die
		;;

	esac

	# Backend responses don't contain a newline.
	echo
}

main "$@"
