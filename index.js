require("dotenv").config();
const github = require("@actions/github");

const issueBranchRegex = /^issue\/(\d+)/;

async function run() {
  const octokit = github.getOctokit(process.env.ACCESS_TOKEN);

  const context = github.context;
  const owner = context.repo.owner;
  const repo = context.repo.repo;

  // ref for pull looks like "refs/pull/19/merge"
  if (context.ref.split("/")[1] !== "pull") {
    console.log("This isn't a pull request.");
    return;
  }

  const pullNumber = context.ref.split("/")[2];
  let issueNumber;

  try {
    const { data: pull } = await octokit.rest.pulls.get({
      owner: owner,
      repo: repo,
      pull_number: pullNumber,
    });
    const branchName = pull.head.ref;
    console.log(branchName);

    const baseBranch = pull.base.ref;
    if (baseBranch.split("/")[0] !== "release") {
      console.log("This is not a release branch.");
      return;
    }

    try {
      // assumes the branch is called e.g. issue/123-some_text
      issueNumber = branchName.match(issueBranchRegex)[1];
      console.log(`issue # is ${issueNumber}`);
    } catch {
      console.log(`Couldn't find an issue number in "${branchName}"`);
      return;
    }

    addCommentWithIssueNumber(octokit, owner, repo, pullNumber, issueNumber);
    const newTitle = await getIssueTitle(octokit, owner, repo, issueNumber);
    changePullTitle(octokit, owner, repo, pullNumber, newTitle);
  } catch (error) {
    console.log(`Failed to find PR ${pullNumber}`);
    console.log(error);
  }
}

run();

async function addCommentWithIssueNumber(
  octokit,
  owner,
  repo,
  pullNumber,
  issueNumber
) {
  try {
    // To comment generally on a PR, it's actually the issue comment API.
    // Github considers pull comments to be for the actual code (review comments)
    octokit.rest.issues.createComment({
      owner: owner,
      repo: repo,
      issue_number: pullNumber,
      body: `This pull request is for issue #${issueNumber}.`,
    });
  } catch (error) {
    console.log(`Failed to add a comment to PR/issue ${pullNumber}`);
    console.log(error);
  }
}

async function getIssueTitle(octokit, owner, repo, issueNumber) {
  let issueTitle;
  try {
    const { data: issue } = await octokit.rest.issues.get({
      owner: owner,
      repo: repo,
      issue_number: issueNumber,
    });
    issueTitle = issue.title;
    console.log(issueTitle);
  } catch (error) {
    console.log(`Failed to find title for issue ${issueNumber}`);
    console.log(error);
  }
  return `${issueTitle} (close #${issueNumber})`;
}

async function changePullTitle(octokit, owner, repo, pullNumber, newTitle) {
  try {
    octokit.rest.pulls.update({
      owner: owner,
      repo: repo,
      pull_number: pullNumber,
      title: newTitle,
    });
    console.log(`Updated the title for PR #${pullNumber}`);
  } catch (error) {
    console.log(`Failed to update title for PR ${pullNumber}`);
    console.log(error);
  }
}
