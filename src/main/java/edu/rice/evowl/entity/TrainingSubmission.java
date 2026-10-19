package edu.rice.evowl.entity;

import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import java.util.Date;
import lombok.Data;

@Data
@ApiModel("Training Submission Info")
public class TrainingSubmission {

  @ApiModelProperty("assign id")
  private int assign_id;

  @ApiModelProperty("primary key")
  private String submission_id;

  @ApiModelProperty("unique id")
  private String unique_id;

  @ApiModelProperty("submit time")
  private Date submit_time;

  @ApiModelProperty("choices")
  private String choices;

  @ApiModelProperty("free_responses")
  private String free_responses;
}
